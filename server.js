const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // Serve the main page
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html - Make sure the file exists!');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
    // Serve CSS
    else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('CSS not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    }
    // Serve JavaScript
    else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('JS not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    }
    // 404 for everything else
    else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const wss = new WebSocket.Server({ server });

// Store messages temporarily (will be cleared on server restart)
let connectedUsers = [];

wss.on('connection', (ws) => {
    console.log('New connection!');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            // Broadcast to ALL connected clients (including sender for sent status)
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    // Mark if this is the sender
                    const messageData = {
                        ...data,
                        isSent: client === ws
                    };
                    client.send(JSON.stringify(messageData));
                }
            });
        } catch (error) {
            console.log('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('User disconnected');
    });

    ws.on('error', (error) => {
        console.log('WebSocket error:', error);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Syncware is running!`);
    console.log(`📱 Open: http://localhost:${PORT}`);
    console.log(`🔒 No messages are stored - 100% private`);
    console.log('=================================');
});