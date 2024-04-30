const vm = require('vm');
const path = require('path');
const fs = require('fs');

const extractAndParseJsonBlock = (text, tools) => {

    if (!text) return { result: null, success: false };
    
    let stack = [];
    let start_index = null;
    let results = [];

    console.log(`Text to be JSON extracted: ${text}`);

    for (let index = 0; index < text.length; index++) {
        let char = text.charAt(index);
        if (char === '{') {
            stack.push(char);
            if (stack.length === 1) {
                start_index = index;
            }
        } else if (char === '}' && stack.length) {
            stack.pop();
            if (stack.length === 0 && start_index !== null) {
                try {
                    let jsonBlock = text.slice(start_index, index + 1);
                    let inString = false;
                    let escaped = false;
                    let jsonBlockList = Array.from(jsonBlock).map((c, i) => {
                        if (c === '"' && !escaped) {
                            inString = !inString;
                        } else if (inString && c === '\n') {
                            return '\\n';
                        }
                        escaped = (c === '\\') && !escaped;
                        return c;
                    });

                    jsonBlock = jsonBlockList.join('');
                    let parsedJson = JSON.parse(jsonBlock);
                    results.push(parsedJson);
                    start_index = null;
                } catch (e) {
                    // If JSON parsing fails, continue to the next block
                    continue;
                }
            }
        }
    }
    console.log(`Extracted JSON blocks: ${results}`);
    //const metadataFields = ['topics', 'intent'];
    // Optionally, check for other function calling tools if needed
    if (tools) {
        const metadataFields = []
        metadataFields.push('tools');
        for (let result of results) {
            if (metadataFields.every(field => field in result)) {
                return { result: result, success: true };
            }
        }
        return { result: text, success: false };
    } else {
        return { result: results[0], success: true };
    }
};

class RuntimeMemoryStorage {

    constructor() {
        this.storage = {};
    }

    set(key, value) {
        this.storage[key] = value;
        return { success: true, message: `Data for key '${key}' set successfully.` };
    }

    get(key) {
        if (key in this.storage) {
            return { success: true, message: `Data for key '${key}' retrieved successfully.`, data: this.storage[key] };
        }
        return { success: false, message: `No data found for key '${key}'.` };
    }

    del(key) {
        if (key in this.storage) {
            delete this.storage[key];
            return { success: true, message: `Data for key '${key}' deleted successfully.` };
        }
        return { success: false, message: `No data found for key '${key}'.` };
    }
}

class JsonStorage {
    constructor(filename) {
        this.filePath = path.join(__dirname, filename);
        this.data = this.loadData();
    }

    loadData() {
        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            // Create a new file if it does not exist or handle other errors
            if (error.code === 'ENOENT') {
                fs.writeFileSync(this.filePath, '{}');
                return {};
            } else {
                throw error;
            }
        }
    }

    saveData() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 4), 'utf8');
    }

    upsert(key, value, keyGroup = 'default') {
        if (!this.data[keyGroup]) {
            this.data[keyGroup] = {};
        }
        this.data[keyGroup][key] = value;
        this.saveData();
    }

    retrieve(field, value) {
        if (field === 'key_group') {
            return this.data[value] || null;
        } else if (field === 'key') {
            for (const keyGroup in this.data) {
                if (this.data[keyGroup][value]) {
                    return this.data[keyGroup][value];
                }
            }
        }
        return null;
    }
}


const allowedBuiltins = (categories) => {
    const builtinCategoryMap = {
        'math': ['Math.abs', 'Math.min', 'Math.max', 'Math.sum', 'Math.pow', 'Math.round'],
        'type_conversion': ['Number', 'String', 'Boolean'],
        'data_structures': ['Array', 'Object'],
        'iterative_functions': ['Symbol.iterator'],
        'string_functions': ['String.fromCharCode', 'String.charCodeAt'],
        'functional_tools': ['Array.map', 'Array.filter'],
        'miscellaneous': ['console.log', 'typeof']
    };

    let allowed = {};

    for (let category in categories) {
        if (categories[category] && category in builtinCategoryMap) {
            builtinCategoryMap[category].forEach(func => {
                const path = func.split('.');
                let obj = global;
                path.forEach(step => {
                    if (obj) obj = obj[step];
                });
                if (obj) allowed[func] = obj;
            });
        }
    }

    return allowed;
};

let globalNodeCodeRunnerState = {};

const nodeCodeRunner = ({code, stateKey = "session"}) => {
    // Initialize variables to hold the script and result
    let script, result;

    // Backup the original console functions
    const originalConsoleLog = console.log;
    const originalConsoleWarning = console.warn;
    const originalConsoleInfo = console.info;
    const originalConsoleError = console.error;

    try {
        if (!code) throw new Error("No code provided");

        // Load or initialize the state
        const state = globalNodeCodeRunnerState[stateKey] || {};

        // Buffer to capture console output
        let outputBuffer = [];

        // Override console methods to capture output
        console.log = console.warn = console.info = console.error = (...args) => {
            outputBuffer.push(args.join(' '));
        };

        // Setup the VM context
        const context = {console, [stateKey]: state, Math, Array, Object, Number, String, Boolean, Symbol};

        // Include allowed functions into the context
        const allowedFunctions = allowedBuiltins({
            'math': true, 'type_conversion': true, 'data_structures': true,
            'iterative_functions': true, 'string_functions': true,
            'functional_tools': true, 'miscellaneous': true
        });

        for (const key in allowedFunctions) {
            let obj = context;
            const path = key.split('.');
            for (let i = 0; i < path.length - 1; i++) {
                obj = obj[path[i]] || {};
            }
            obj[path[path.length - 1]] = allowedFunctions[key];
        }

        // Compile and run the script
        script = new vm.Script(code);
        result = script.runInNewContext(context, {timeout: 1000});

        // Update the global state
        globalNodeCodeRunnerState[stateKey] = context[stateKey];

        return { result, consoleOutput: outputBuffer.join('\n'), success: true };

    } catch (e) {
        // Handle both syntax and runtime errors uniformly
        return { error: `Error: ${e.message}`, success: false };
    } finally {
        // Restore the original console functions once done
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarning;
        console.info = originalConsoleInfo;
    }
};

module.exports = {
    RuntimeMemoryStorage, 
    JsonStorage, 
    nodeCodeRunner,
    extractAndParseJsonBlock
};
