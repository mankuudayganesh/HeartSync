const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) { res.writeHead(500); return res.end('Error loading page'); }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
    else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
            if (err) { res.writeHead(404); return res.end('Not found'); }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    }
    else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, data) => {
            if (err) { res.writeHead(404); return res.end('Not found'); }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    }
    else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    }
    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('💚 New connection!');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📩 ${data.username}: ${data.message}`);

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    const messageData = {
                        ...data,
                        isSent: client === ws
                    };
                    client.send(JSON.stringify(messageData));
                }
            });
        } catch (error) {
            console.log('Error:', error);
        }
    });

    ws.on('close', () => console.log('👋 User left'));
    ws.on('error', (error) => console.log('WS error:', error));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Syncware backend running on port ${PORT}`);
});
