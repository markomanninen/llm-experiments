const { writeFile, readFile } = require('./fileOperations');
const { commitChanges, getCommitLogs, revertToCommit } = require('./gitOperations');

const jsFilePath = './public/script.js';
const cssFilePath = './public/style.css';
const htmlFilePath = './public/tree.html';

module.exports = function(app, io) {
    // CRUD operations for HTML elements
    app.post('/element', async (req, res) => {
        // Assume htmlTree is being managed somewhere in the server state
        const { id, content } = req.body;
        global.htmlTree += `<div id="${id}">${content}</div>`; // Adding element
        await writeFile(htmlFilePath, global.htmlTree);
        io.emit('update', global.htmlTree);
        await commitChanges(`Added element ${id}`);
        res.status(201).send({ message: 'Element added', htmlTree: global.htmlTree });
    });

    app.put('/element/:id', async (req, res) => {
        const { content } = req.body;
        const start = global.htmlTree.indexOf(`<div id="${req.params.id}">`);
        if (start === -1) {
            res.status(404).send({ message: 'Element not found' });
            return;
        }
        const end = global.htmlTree.indexOf('</div>', start) + 6;
        const oldElement = global.htmlTree.substring(start, end);
        const newElement = `<div id="${req.params.id}">${content}</div>`;
        global.htmlTree = global.htmlTree.replace(oldElement, newElement);
        await writeFile(htmlFilePath, global.htmlTree);
        io.emit('update', global.htmlTree);
        await commitChanges(`Updated element ${req.params.id}`);
        res.send({ message: 'Element updated', htmlTree: global.htmlTree });
    });

    app.delete('/element/:id', async (req, res) => {
        const start = global.htmlTree.indexOf(`<div id="${req.params.id}">`);
        if (start === -1) {
            res.status(404).send({ message: 'Element not found' });
            return;
        }
        const end = global.htmlTree.indexOf('</div>', start) + 6;
        const element = global.htmlTree.substring(start, end);
        global.htmlTree = global.htmlTree.replace(element, '');
        await writeFile(htmlFilePath, global.htmlTree);
        io.emit('update', global.htmlTree);
        await commitChanges(`Deleted element ${req.params.id}`);
        res.send({ message: 'Element deleted', htmlTree: global.htmlTree });
    });

    // Route to handle JavaScript updates
    app.post('/update_js', async (req, res) => {
        try {
            await writeFile(jsFilePath, req.body.content);
            io.emit('update_js', req.body.content);
            await commitChanges('Updated JavaScript content');
            res.send({ message: 'JavaScript updated' });
        } catch (error) {
            res.status(500).send({ message: 'Failed to update JavaScript', error });
        }
    });

    // Route to handle CSS updates
    app.post('/update_css', async (req, res) => {
        try {
            await writeFile(cssFilePath, req.body.content);
            io.emit('update_css', req.body.content);
            await commitChanges('Updated CSS content');
            res.send({ message: 'CSS updated' });
        } catch (error) {
            res.status(500).send({ message: 'Failed to update CSS', error });
        }
    });

    // Route to get commit logs
    app.get('/commits', async (req, res) => {
        try {
            const logs = await getCommitLogs(req.query);
            res.send(logs);
        } catch (error) {
            res.status(500).send({ message: 'Failed to retrieve commit logs', error });
        }
    });

    // Route to revert to a specific commit
    app.post('/revert', async (req, res) => {
        const { commitHash } = req.body;
        try {
            await revertToCommit(commitHash);
            global.htmlTree = await readFile(htmlFilePath); // Reload the HTML tree file
            io.emit('update', global.htmlTree);
            res.send({ message: `Reverted to commit ${commitHash}` });
        } catch (error) {
            res.status(500).send({ message: 'Failed to revert to commit', error });
        }
    });
};
