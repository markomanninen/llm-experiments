const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import routes configuration
const configureRoutes = require('./routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Global state for the HTML tree
global.htmlTree = "<div id='root'></div>";

app.use(express.json()); // Middleware to parse JSON
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

// Initialize and configure routes
configureRoutes(app, io);

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.emit('update', global.htmlTree); // Send current state of HTML tree on new connection

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Listen on port 3000
server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
