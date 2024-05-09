const fs = require('fs').promises;
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import routes configuration
// TODO: These are redundant and should be removed after transferring codes
const configureRoutes = require('./routes');
const configureRoutesGit = require('./routes/git');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const htmlFilePath = './public/tree.html';
const defaultTree = '';

// Function to load the HTML tree from file
async function loadHtmlTree() {
    try {
        const data = await fs.readFile(htmlFilePath, 'utf8');
        return data || defaultTree; // If the file is empty, return a default tree
    } catch (error) {
        console.error('Failed to read HTML tree file:', error);
        return defaultTree; // Return default tree if there's an error
    }
}

// Set global HTML tree
async function initializeHtmlTree() {
    global.htmlTree = await loadHtmlTree();
}

initializeHtmlTree().then(() => {
    console.log('HTML Tree loaded successfully.');
    // Start the server after the HTML tree has been loaded
    server.listen(3000, () => {
        console.log('Server listening on port 3000');
    });
});

app.use(express.json()); // Middleware to parse JSON
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

// Initialize and configure routes
configureRoutes(app, io);
configureRoutesGit(app, io);

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.emit('update', global.htmlTree); // Send current state of HTML tree on new connection

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});
