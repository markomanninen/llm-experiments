// Read sub directories and export all tool schemas
/*
tools = {
    "subdir": {
        "header": "from header.txt if exists",
        "definitions": {from definitions.json if exists},
        "schemas": {
            "schema": {from schema.json},
            ...
        }
    },
    ...
}
*/

const fs = require('fs');
const path = require('path');
const tools = fs.readdirSync(__dirname)
    .filter(file => fs.lstatSync(path.join(__dirname, file)).isDirectory())
    .reduce((acc, dir) => {
        const headerPath = path.join(__dirname, dir, 'header.txt');
        const definitionsPath = path.join(__dirname, dir, 'definitions.json');
        const schemasPath = path.join(__dirname, dir, 'schemas');
        const header = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
        const definitions = fs.existsSync(definitionsPath) ? require(definitionsPath) : {};
        // Each schema file becomes a key in schemas object
        // {"subdir": {file contents}, "subdir2": {file contents}, ...}
        const schemas = fs.readdirSync(schemasPath)
            .reduce((acc, file) => {
                const schemaName = file.replace('.json', '');
                acc[schemaName] = require(path.join(schemasPath, file));
                return acc;
            }, {});
        acc[dir] = { header, definitions, schemas };
        return acc;
    }, {});

module.exports = {tools};