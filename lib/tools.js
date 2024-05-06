const { tools: toolSchemas } = require('../tools/index.js');

const collectSchemas = (toolArgs, toolSchemas) => {
    let selectedSchemas = {};
    let definitions = [];

    const findDefinitionReferences = (schema) => {
        if (schema instanceof Array) {
            schema.forEach(item => findDefinitionReferences(item));
        } else if (typeof schema === 'object' && schema !== null) {
            if ('$ref' in schema) {
                let ref = schema['$ref'].split('/').pop();
                if (!definitions.includes(ref)) {
                    definitions.push(ref);
                }
            }
            Object.values(schema).forEach(value => findDefinitionReferences(value));
        }
    };

    toolArgs.forEach(arg => {
        if (!arg.includes("~")) {
            let parts = arg.split(".");
            if (parts.length === 1) {
                let group = parts[0];
                if (group in toolSchemas) {
                    selectedSchemas[group] = {
                        header: toolSchemas[group].header,
                        schemas: { ...toolSchemas[group].schemas }
                    };
                    if ('definitions' in toolSchemas[group] && !('definitions' in selectedSchemas[group])) {
                        selectedSchemas[group].definitions = { ...toolSchemas[group].definitions };
                    }
                } else {
                    console.log(`Provided tool group '${group}' not found, skipping...`);
                }
            } else if (parts.length === 2) {
                let [mainGroup, subGroup] = parts;
                if (!(mainGroup in toolSchemas)) {
                    console.log(`Provided tool group '${mainGroup}' not found, skipping...`);
                    return;
                }
                if (!(subGroup in toolSchemas[mainGroup].schemas)) {
                    console.log(`Provided tool '${subGroup}' not defined, skipping...`);
                    return;
                }
                if (!(mainGroup in selectedSchemas)) {
                    selectedSchemas[mainGroup] = {
                        header: toolSchemas[mainGroup].header,
                        schemas: {}
                    };
                }
                selectedSchemas[mainGroup].schemas[subGroup] = toolSchemas[mainGroup].schemas[subGroup];
                if ('definitions' in toolSchemas[mainGroup] && !('definitions' in selectedSchemas[mainGroup])) {
                    selectedSchemas[mainGroup].definitions = { ...toolSchemas[mainGroup].definitions };
                }
            }
        }
    });

    // Then process exclusions
    toolArgs.filter(arg => arg.includes("~")).forEach(arg => {
        let [mainGroup, subGroup] = arg.split("~")[1].split(".");
        if (mainGroup in selectedSchemas && subGroup in selectedSchemas[mainGroup].schemas) {
            delete selectedSchemas[mainGroup].schemas[subGroup];
        }
    });

    // Find definition references for all schemas
    Object.values(selectedSchemas).forEach(schema => {
        Object.values(schema.schemas).forEach(subSchema => {
            findDefinitionReferences(subSchema.arguments);
        });
    });

    // Remove unused definitions
    Object.entries(selectedSchemas).forEach(([tool, schema]) => {
        if ('definitions' in schema) {
            Object.keys(schema.definitions).forEach(field => {
                if (!definitions.includes(field)) {
                    delete selectedSchemas[tool].definitions[field];
                }
            });
        }
    });

    return selectedSchemas;
};

const renderSelectedSchemas = (toolArgs) => {
    let result = "", humanFormat = "";

    let collectedSchemas = collectSchemas(toolArgs, toolSchemas);
    Object.entries(collectedSchemas).forEach(([group, content]) => {
        result += `\n${content.header}\n`;
        humanFormat += `\n${content.header}\n`;

        let data;
        if ('definitions' in content) {
            data = {
                definitions: content.definitions,
                schemas: content.schemas
            };
        } else {
            data = content.schemas;
        }

        Object.entries(content.schemas).forEach(([tool, schema]) => {
            humanFormat += `\n- ${tool}: ${schema.description}\n`;
        });

        result += `\n${JSON.stringify(data)}\n`;
    });

    return [result, humanFormat];
};

let secretVault = {}
let showSecretVaultSetter = false;

async function revealSecretKey(command) {
    const commandTrimmed = command.trim();
    const firstSpaceIndex = commandTrimmed.indexOf(" ");
    if (firstSpaceIndex === -1) {
        console.warn("Invalid command format. Use '\\secret <key_name>'.");
        return;
    }
    const key = commandTrimmed.substring(firstSpaceIndex + 1).trim();
    // If secretVault has no key
    if (!(key in secretVault)) {
        console.log(`No such key (${key}) in the secret vault.`);
        return;
    }
    // User watched the secret key...
    console.log(`\x1B[38;5;45m${key}=${secretVault[key]}\x1B[0m`);
    await handleResponse(await spinRequest(
        getPrompt("secretKeyExposePrompt").replace("<<value>>", secretVault[key]).replace("<<key_name>>", key))
    );
}

function handleSecretVault(text) {
    const regex = /{[^{}]*}/g;
    let cleanedText = text;
    // Collect all JSON snippets and their indexes
    let match;
    const matches = [];
    while ((match = regex.exec(text)) !== null) {
        matches.push({
            json: match[0],
            index: match.index,
            length: match[0].length
        });
    }
    // Reverse iterate through matches to ensure indexes remain correct as we modify text
    for (let i = matches.length - 1; i >= 0; i--) {
        const { json, index, length } = matches[i];
        try {
            const parsed = JSON.parse(json);
            let encoded_json_block = ''
            // get command
            if (parsed.get) {
                const value = parsed.get in secretVault ? secretVault[parsed.get] : 'n/a';
                //console.log(`\rSECRET GET: ${parsed.get}:${value}`);
                encoded_json_block = `\x1B[38;5;45mGOT ${parsed.get}\x1B[0m`;
                // delete command
            } else if (parsed.del) {
                const value = parsed.del in secretVault ? secretVault[parsed.del] : 'n/a';
                //console.log(`\rSECRET DEL: ${parsed.del}:${value}`);
                delete secretVault[parsed.del];
                encoded_json_block = `\x1b[31mDELETED ${parsed.del}\x1B[0m`;
                // set command
            } else {
                const [firstEntry] = Object.entries(parsed);
                const [key, value] = firstEntry;
                secretVault[key] = value;
                // Show the secret vault setter if enabled
                // This is useful for debugging and tracking secret vault changes
                // but for real gaming purposes, it should be disabled
                // LLM models may set wrong values, placeholders etc. to the secret vault
                // especially the smaller models
                if (showSecretVaultSetter) {
                    console.info(`\rSECRET SET: ${key}:${value}`);
                }
                encoded_json_block = `\x1B[32mSET ${key}=***\x1B[0m`;
            }
            // Remove the JSON snippet from the text
            cleanedText = cleanedText.slice(0, index) + encoded_json_block + cleanedText.slice(index + length);
        } catch (error) {
            // "Quietly" pass errors which were not valid json
            console.error(`Failed to parse JSON in vault handler: ${json}, error: ${error}`);
        }
    }
    return cleanedText;
}

module.exports = {
    renderSelectedSchemas
};