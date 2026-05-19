// Your backend URL - Updated with your actual Render URL
const BACKEND_URL = 'wss://heartsync-backend-8fta.onrender.com';

let ws = null;
let myName = '';

function startChat() {
    console.log('startChat function called!');
    
    const nameInput = document.getElementById('nameInput');
    myName = nameInput.value.trim();
    
    if (!myName) {
        alert('Please enter your name first!');
        return;
    }

    console.log('Connecting to:', BACKEND_URL);

    try {
        ws = new WebSocket(BACKEND_URL);

        ws.onopen = function() {
            console.log('WebSocket connected successfully!');
            
            // Hide login, show chat
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('chatScreen').style.display = 'flex';
            
            // Send join message
            const joinMsg = {
                type: 'system',
                username: 'System',
                message: `${myName} joined the chat 💚`,
                timestamp: new Date().toLocaleTimeString(),
                isSent: false
            };
            ws.send(JSON.stringify(joinMsg));
            
            console.log('Join message sent');
        };

        ws.onmessage = function(event) {
            console.log('Message received:', event.data);
            const data = JSON.parse(event.data);
            
            if (data.type === 'system') {
                addSystemMessage(data.message);
            } else if (data.type === 'message') {
                addMessage(data.username, data.message, data.timestamp, data.isSent);
            }
        };

        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            alert('Connection failed! Make sure your backend is running.');
        };

        ws.onclose = function() {
            console.log('WebSocket connection closed');
            addSystemMessage('Connection lost... 💔');
        };

    } catch (error) {
        console.error('Error creating WebSocket:', error);
        alert('Failed to connect. Check the console for details.');
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected! Please refresh the page.');
        return;
    }
    
    const messageData = {
        type: 'message',
        username: myName,
        message: text,
        timestamp: new Date().toLocaleTimeString(),
        isSent: false
    };
    
    console.log('Sending message:', messageData);
    ws.send(JSON.stringify(messageData));
    input.value = '';
}

function addMessage(sender, text, time, isSent) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    
    messageDiv.innerHTML = `
        <div class="message-name">${isSent ? 'You' : sender}</div>
        <div>${text}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-message';
    sysDiv.textContent = text;
    
    container.appendChild(sysDiv);
    container.scrollTop = container.scrollHeight;
}

// Debug: Check if script loaded
console.log('script.js loaded successfully!');
console.log('startChat function is:', typeof startChat);
