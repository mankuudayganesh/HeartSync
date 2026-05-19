// Backend URL
const BACKEND_URL = 'wss://heartsync-backend-8fta.onrender.com';

let ws = null;
let myName = '';
let localStream = null;
let peerConnection = null;
let currentCallType = null;

// ==================== CHAT FUNCTIONS ====================

function startChat() {
    console.log('Starting chat...');
    myName = document.getElementById('nameInput').value.trim();
    
    if (!myName) {
        alert('Please enter your name!');
        return;
    }

    ws = new WebSocket(BACKEND_URL);

    ws.onopen = () => {
        console.log('Connected!');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('chatScreen').style.display = 'flex';
        
        ws.send(JSON.stringify({
            type: 'join',
            username: myName,
            timestamp: getTime()
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Connection failed!');
    };

    ws.onclose = () => {
        addSystemMessage('Connection lost... 💔');
    };
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
        type: 'message',
        username: myName,
        message: text,
        timestamp: getTime()
    }));
    
    input.value = '';
}

// ==================== IMAGE FUNCTIONS ====================

function sendImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            ws.send(JSON.stringify({
                type: 'image',
                username: myName,
                imageData: event.target.result,
                imageId: imageId,
                timestamp: getTime()
            }));
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

function downloadImage(imageData, imageId) {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `syncware_${imageId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== CALL FUNCTIONS ====================

async function startCall(callType) {
    currentCallType = callType;
    
    try {
        // Get user media
        const constraints = {
            audio: true,
            video: callType === 'video'
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Show call screen
        document.getElementById('callScreen').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        
        // Send call start signal
        ws.send(JSON.stringify({
            type: 'call-start',
            username: myName,
            callType: callType
        }));
        
        // Create peer connection
        createPeerConnection();
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        ws.send(JSON.stringify({
            type: 'webrtc-offer',
            offer: offer
        }));
        
    } catch (error) {
        console.error('Call error:', error);
        alert('Failed to start call. Check camera/microphone permissions.');
    }
}

function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'webrtc-ice-candidate',
                candidate: event.candidate
            }));
        }
    };
    
    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };
    
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected') {
            endCall();
        }
    };
}

async function acceptCall() {
    document.getElementById('incomingCall').style.display = 'none';
    
    try {
        const constraints = {
            audio: true,
            video: currentCallType === 'video'
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        document.getElementById('callScreen').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        
        createPeerConnection();
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        ws.send(JSON.stringify({
            type: 'call-accept',
            username: myName
        }));
        
    } catch (error) {
        console.error('Accept call error:', error);
    }
}

function rejectCall() {
    document.getElementById('incomingCall').style.display = 'none';
    ws.send(JSON.stringify({
        type: 'call-reject',
        username: myName
    }));
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnection) {
        peerConnection.close();
    }
    
    document.getElementById('callScreen').style.display = 'none';
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('remoteVideo').srcObject = null;
    
    ws.send(JSON.stringify({
        type: 'call-end',
        username: myName
    }));
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const muteBtn = document.querySelector('.mute-btn');
            muteBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
        }
    }
}

// ==================== MESSAGE HANDLER ====================

function handleIncomingMessage(data) {
    switch(data.type) {
        case 'system':
            addSystemMessage(data.message);
            break;
            
        case 'message':
            addMessage(data.username, data.message, data.timestamp, data.isSent);
            break;
            
        case 'image':
            addImageMessage(data.username, data.imageData, data.imageId, data.timestamp, data.isSent);
            break;
            
        case 'call-start':
            handleIncomingCall(data.username, data.callType);
            break;
            
        case 'call-accept':
            handleCallAccepted();
            break;
            
        case 'call-reject':
            handleCallRejected(data.username);
            break;
            
        case 'call-end':
            handleCallEnded();
            break;
            
        case 'webrtc-offer':
            handleWebRTCOffer(data.offer);
            break;
            
        case 'webrtc-answer':
            handleWebRTCAnswer(data.answer);
            break;
            
        case 'webrtc-ice-candidate':
            handleICECandidate(data.candidate);
            break;
    }
}

// ==================== UI FUNCTIONS ====================

function addMessage(sender, text, time, isSent) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    
    messageDiv.innerHTML = `
        <div class="message-name">${isSent ? 'You' : sender}</div>
        <div>${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function addImageMessage(sender, imageData, imageId, time, isSent) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    messageDiv.id = imageId;
    
    // Create 10-minute auto-delete timer
    const deleteTime = Date.now() + 600000; // 10 minutes
    
    messageDiv.innerHTML = `
        <div class="message-name">${isSent ? 'You' : sender}</div>
        <div class="image-message" onclick="viewFullImage('${imageData}')">
            <img src="${imageData}" alt="Shared image">
            <div class="image-timer" id="timer_${imageId}">10:00</div>
        </div>
        <div class="image-actions">
            <button class="download-btn" onclick="downloadImage('${imageData}', '${imageId}')">💾 Save</button>
            <button class="delete-btn" onclick="deleteImage('${imageId}')">🗑️ Delete</button>
        </div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // Start countdown timer
    startImageTimer(imageId, deleteTime);
}

function startImageTimer(imageId, deleteTime) {
    const timerElement = document.getElementById(`timer_${imageId}`);
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, deleteTime - now);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            deleteImage(imageId);
        }
    }, 1000);
}

function deleteImage(imageId) {
    const imageElement = document.getElementById(imageId);
    if (imageElement) {
        imageElement.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            imageElement.remove();
        }, 300);
    }
}

function viewFullImage(imageData) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imageData;
    img.style.cssText = 'max-width: 90%; max-height: 90%; border-radius: 10px;';
    
    overlay.appendChild(img);
    overlay.onclick = () => document.body.removeChild(overlay);
    document.body.appendChild(overlay);
}

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-message';
    sysDiv.textContent = text;
    
    container.appendChild(sysDiv);
    container.scrollTop = container.scrollHeight;
}

// ==================== CALL HANDLERS ====================

function handleIncomingCall(caller, callType) {
    currentCallType = callType;
    document.getElementById('callerName').textContent = caller;
    document.getElementById('callType').textContent = callType === 'video' ? 'Video Call' : 'Voice Call';
    document.getElementById('incomingCall').style.display = 'block';
}

async function handleWebRTCOffer(offer) {
    if (!peerConnection) createPeerConnection();
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    ws.send(JSON.stringify({
        type: 'webrtc-answer',
        answer: answer
    }));
}

async function handleWebRTCAnswer(answer) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

async function handleICECandidate(candidate) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

function handleCallAccepted() {
    document.getElementById('callStatus').textContent = 'Connected';
}

function handleCallRejected(username) {
    alert(`${username} rejected the call`);
    endCall();
}

function handleCallEnded() {
    endCall();
}

// ==================== HELPERS ====================

function getTime() {
    return new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Debug
console.log('Syncware 2.0 loaded! 📞📸');
