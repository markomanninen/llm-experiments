const fs = require('fs');

/**
 * Writes or appends content to a file.
 * @param {string} path - The file path where the content should be written.
 * @param {string} content - The content to write to the file.
 * @param {boolean} [append=false] - Whether to append the content instead of overwriting.
 * @returns {Promise<void>} - A promise that resolves when the write operation is complete, or rejects with an error.
 */
function writeFile(path, content, append = false) {
    return new Promise((resolve, reject) => {
        const writeFunction = append ? fs.appendFile : fs.writeFile;

        writeFunction(path, content, 'utf8', (err) => {
            if (err) {
                console.error(`Failed to ${append ? 'append to' : 'write'} file:`, path, err);
                reject(err);
            } else {
                console.log(`${append ? 'Appended to' : 'Content written to'} ${path}`);
                resolve();
            }
        });
    });
}

/**
 * Reads content from a file asynchronously.
 * @param {string} path - The file path from which to read.
 * @returns {Promise<string>} - A promise that resolves with the content of the file, or rejects with an error.
 */
function readFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                console.error('Failed to read file:', path, err);
                reject(err);
            } else {
                console.log(`Content read from ${path}`);
                resolve(data);
            }
        });
    });
}

module.exports = {
    writeFile,
    readFile
};
