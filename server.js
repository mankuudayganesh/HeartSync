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

// Store active calls
const activeCalls = new Map();

wss.on('connection', (ws) => {
    console.log('💚 New connection!');
    let username = '';

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle different message types
            switch(data.type) {
                case 'join':
                    username = data.username;
                    broadcast({
                        type: 'system',
                        message: `${username} joined 💚`,
                        timestamp: getTime()
                    }, ws);
                    break;

                case 'message':
                    broadcast({
                        type: 'message',
                        username: username,
                        message: data.message,
                        timestamp: getTime(),
                        isSent: false
                    }, ws);
                    break;

                case 'image':
                    broadcast({
                        type: 'image',
                        username: username,
                        imageData: data.imageData,
                        imageId: data.imageId,
                        timestamp: getTime(),
                        expiresIn: 600, // 10 minutes in seconds
                        isSent: false
                    }, ws);
                    break;

                case 'call-start':
                    broadcast({
                        type: 'call-start',
                        username: username,
                        callType: data.callType // 'voice' or 'video'
                    }, ws);
                    break;

                case 'call-accept':
                    broadcast({
                        type: 'call-accept',
                        username: username
                    }, ws);
                    break;

                case 'call-reject':
                    broadcast({
                        type: 'call-reject',
                        username: username
                    }, ws);
                    break;

                case 'call-end':
                    broadcast({
                        type: 'call-end',
                        username: username
                    }, ws);
                    break;

                case 'webrtc-offer':
                case 'webrtc-answer':
                case 'webrtc-ice-candidate':
                    // Forward WebRTC signaling data
                    broadcast(data, ws);
                    break;
            }
        } catch (error) {
            console.log('Error:', error);
        }
    });

    ws.on('close', () => {
        if (username) {
            broadcast({
                type: 'system',
                message: `${username} left 💔`,
                timestamp: getTime()
            });
        }
    });
});

function broadcast(data, sender = null) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            const messageData = {
                ...data,
                isSent: client === sender
            };
            client.send(JSON.stringify(messageData));
        }
    });
}

function getTime() {
    return new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Syncware 2.0 running on port ${PORT}`);
    console.log('📞 Voice/Video calls enabled');
    console.log('📸 Image sharing with 10-min auto-delete');
});
