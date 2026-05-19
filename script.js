let ws;
let myName = '';

function startChat() {
    myName = document.getElementById('nameInput').value.trim();
    
    if (!myName) {
        alert('Please enter your name!');
        return;
    }

    // Connect to WebSocket
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected!');
        
        // Switch screens
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
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'system') {
            addSystemMessage(data.message);
        } else if (data.type === 'message') {
            addMessage(data.username, data.message, data.timestamp, data.isSent);
        }
    };

    ws.onerror = (error) => {
        console.log('Error:', error);
        alert('Connection error! Make sure the server is running.');
    };

    ws.onclose = () => {
        addSystemMessage('Connection lost... 💔');
    };
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text && ws && ws.readyState === WebSocket.OPEN) {
        const messageData = {
            type: 'message',
            username: myName,
            message: text,
            timestamp: new Date().toLocaleTimeString(),
            isSent: false
        };
        
        ws.send(JSON.stringify(messageData));
        input.value = '';
    }
}

function addMessage(sender, text, time, isSent) {
    const container = document.getElementById('messages');
    
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
    const container = document.getElementById('messages');
    
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-message';
    sysDiv.textContent = text;
    
    container.appendChild(sysDiv);
    container.scrollTop = container.scrollHeight;
}