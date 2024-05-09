const vm = require('vm');
const path = require('path');
const fs = require('fs');

const extractAndParseJsonBlock = (text, tools) => {

    if (!text) return { result: null, success: false };
    
    let stack = [];
    let start_index = null;
    let results = [];

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
    return { result: results, success: true }
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
        this.filePath = filename;
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

const nodeCodeRunner = async ({code, stateKey = "session"}) => {

    let outputBuffer = [];

    // Handle log and error messages by collecting them to buffer
    function captureConsoleOutput(method, ...args) {
        const formattedArgs = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return `Unserializable Object: ${e.message}`;
                }
            } else {
                return String(arg);
            }
        });
        outputBuffer.push(formattedArgs.join(' '));
        console.trace(`[${method}]`, ...args);
    }

    try {
        if (!code) throw new Error("No code provided");

        // Console log in async calls like axios, wont get buffered due to async nature of console function
        // Thus we have a custom function which will be used in place of .log/.error functions
        // For instance: console.log("Hello World"); will be replaced by: captureConsoleOutput.bind(null, 'log')("Hello World"));
        code = code.replace(/console\.log/g, "captureConsoleOutput.bind(null, 'log')");
        code = code.replace(/console\.error/g, "captureConsoleOutput.bind(null, 'error')");

        // Load or initialize the state
        const state = globalNodeCodeRunnerState[stateKey] || {};

        // Setup the VM context
        const context = {captureConsoleOutput, [stateKey]: state, require, Math, Array, Object, Number, String, Boolean, Symbol};

        // Include allowed function categories into the context
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

        // Compile and run the script wrapped with try ... catch
        const wrappedCode = `
(async () => {
    try {
        ${code}
    } catch (e) {
        captureConsoleOutput.bind(null, 'error')(e);
    }
})()`;
        const script = new vm.Script(wrappedCode);
        const result = await script.runInNewContext(context, {timeout: 2500});

        // Update the global state
        globalNodeCodeRunnerState[stateKey] = context[stateKey];

        return { result, consoleOutput: outputBuffer.join('\n'), success: true };

    } catch (e) {
        // Handle both syntax and runtime errors uniformly
        return { error: `Error: ${e.message}`, success: false };
    }
};

module.exports = {
    RuntimeMemoryStorage, 
    JsonStorage, 
    nodeCodeRunner,
    extractAndParseJsonBlock
};
