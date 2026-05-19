const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) { res.writeHead(500); return res.end('Error'); }
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
    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

// Store connected users with their WebSocket connections
const users = new Map();

wss.on('connection', (ws) => {
    let username = '';
    let userId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // Send welcome message immediately
    ws.send(JSON.stringify({
        type: 'connected',
        userId: userId,
        message: 'Connected to Syncware!'
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'join':
                    username = data.username;
                    users.set(userId, { ws, username });
                    
                    // Notify others
                    broadcast({
                        type: 'user-joined',
                        username: username,
                        userId: userId,
                        timestamp: getTime()
                    }, ws);
                    
                    // Send current users list
                    const userList = Array.from(users.entries()).map(([id, user]) => ({
                        userId: id,
                        username: user.username
                    }));
                    
                    ws.send(JSON.stringify({
                        type: 'users-list',
                        users: userList
                    }));
                    break;

                case 'message':
                    if (data.message.length > 5000) return; // Limit message size
                    broadcast({
                        type: 'message',
                        username: username,
                        message: data.message.substring(0, 5000),
                        timestamp: getTime(),
                        userId: userId
                    }, ws);
                    break;

                case 'image':
                    // Limit image size to 500KB
                    if (data.imageData && data.imageData.length > 700000) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Image too large. Please use smaller images (max 500KB).'
                        }));
                        return;
                    }
                    
                    broadcast({
                        type: 'image',
                        username: username,
                        imageData: data.imageData,
                        imageId: data.imageId,
                        timestamp: getTime(),
                        userId: userId
                    }, ws);
                    break;

                // WebRTC Signaling - Forward immediately
                case 'call-offer':
                case 'call-answer':
                case 'ice-candidate':
                case 'call-start':
                case 'call-accept':
                case 'call-reject':
                case 'call-end':
                    // Forward to specific user or broadcast
                    if (data.targetUserId) {
                        const targetUser = users.get(data.targetUserId);
                        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
                            targetUser.ws.send(JSON.stringify({
                                ...data,
                                fromUserId: userId,
                                fromUsername: username
                            }));
                        }
                    } else {
                        broadcast(data, ws);
                    }
                    break;
            }
        } catch (error) {
            console.log('Error processing message:', error.message);
        }
    });

    ws.on('close', () => {
        if (username) {
            users.delete(userId);
            broadcast({
                type: 'user-left',
                username: username,
                userId: userId,
                timestamp: getTime()
            });
        }
    });

    ws.on('error', (error) => {
        console.log('WebSocket error:', error.message);
    });
});

function broadcast(data, sender = null) {
    const messageStr = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== sender) {
            client.send(messageStr);
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
    console.log(`🚀 Syncware running on port ${PORT}`);
});
