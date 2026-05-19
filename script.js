// Backend URL - CHANGE THIS to your actual Render backend URL
const BACKEND_URL = 'wss://heartsync-backend-8fta.onrender.com';

let ws = null;
let myName = '';
let myUserId = '';
let localStream = null;
let peerConnection = null;
let currentCallType = null;
let remoteUserId = null;

// ==================== QUICK CONNECT ====================

function startChat() {
    myName = document.getElementById('nameInput').value.trim();
    
    if (!myName) {
        alert('Please enter your name!');
        return;
    }

    // Show connecting state
    const btn = document.getElementById('startBtn');
    btn.textContent = 'Connecting...';
    btn.disabled = true;

    // Connect with timeout
    const connectTimeout = setTimeout(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('Connection timeout! Server might be waking up. Try again in 30 seconds.');
            btn.textContent = 'Start Chatting 💬';
            btn.disabled = false;
        }
    }, 15000);

    ws = new WebSocket(BACKEND_URL);

    ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log('⚡ Connected instantly!');
        
        // Join immediately
        ws.send(JSON.stringify({
            type: 'join',
            username: myName
        }));

        // Show chat screen
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('chatScreen').style.display = 'flex';
        
        addSystemMessage('Connected! Waiting for your partner... 💑');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
            myUserId = data.userId;
            console.log('My ID:', myUserId);
        } else {
            handleMessage(data);
        }
    };

    ws.onerror = (error) => {
        console.error('Connection error');
        alert('Connection failed. The server might be starting up. Please try again in 30 seconds.');
        btn.textContent = 'Start Chatting 💬';
        btn.disabled = false;
    };

    ws.onclose = () => {
        addSystemMessage('Connection lost... Refresh to reconnect 💔');
    };
}

// ==================== MESSAGE HANDLER ====================

function handleMessage(data) {
    switch(data.type) {
        case 'user-joined':
            addSystemMessage(`${data.username} joined! 💚`);
            if (!remoteUserId) remoteUserId = data.userId;
            break;
            
        case 'user-left':
            addSystemMessage(`${data.username} left 💔`);
            break;
            
        case 'users-list':
            if (data.users.length > 1) {
                const otherUser = data.users.find(u => u.userId !== myUserId);
                if (otherUser) {
                    remoteUserId = otherUser.userId;
                    addSystemMessage(`${otherUser.username} is online! 🟢`);
                }
            }
            break;
            
        case 'message':
            addMessage(data.username, data.message, data.timestamp, data.userId === myUserId);
            break;
            
        case 'image':
            addImageMessage(data.username, data.imageData, data.imageId, data.timestamp, data.userId === myUserId);
            break;
            
        case 'call-start':
            handleIncomingCall(data);
            break;
            
        case 'call-accept':
            document.getElementById('callStatus').textContent = 'Connected! 📞';
            break;
            
        case 'call-reject':
            alert(`${data.fromUsername} rejected the call`);
            endCall();
            break;
            
        case 'call-end':
            endCall();
            break;
            
        case 'call-offer':
            handleCallOffer(data);
            break;
            
        case 'call-answer':
            handleCallAnswer(data);
            break;
            
        case 'ice-candidate':
            handleICECandidate(data);
            break;
    }
}

// ==================== FAST MESSAGING ====================

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Send instantly - no delay
    ws.send(JSON.stringify({
        type: 'message',
        username: myName,
        message: text
    }));
    
    // Optimistic UI update
    addMessage('You', text, getTime(), true);
    
    input.value = '';
    input.focus();
}

function addMessage(sender, text, time, isMine) {
    const container = document.getElementById('messagesContainer');
    
    const div = document.createElement('div');
    div.className = `message-bubble ${isMine ? 'message-sent' : 'message-received'}`;
    div.innerHTML = `
        <div class="message-name">${isMine ? 'You' : sender}</div>
        <div>${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ==================== FAST IMAGE SHARING ====================

function sendImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Show uploading indicator
        addSystemMessage('📤 Compressing and sending image...');
        
        try {
            // Compress image before sending
            const compressedImage = await compressImage(file, 800, 0.6);
            
            if (compressedImage.length > 500000) {
                alert('Image still too large after compression. Please try a smaller image.');
                return;
            }
            
            const imageId = 'img_' + Date.now();
            
            ws.send(JSON.stringify({
                type: 'image',
                username: myName,
                imageData: compressedImage,
                imageId: imageId
            }));
            
            // Optimistic UI update
            addImageMessage('You', compressedImage, imageId, getTime(), true);
            
        } catch (error) {
            console.error('Image error:', error);
            alert('Failed to process image. Please try again.');
        }
    };
    
    input.click();
}

async function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize if too large
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function addImageMessage(sender, imageData, imageId, time, isMine) {
    const container = document.getElementById('messagesContainer');
    
    const div = document.createElement('div');
    div.className = `message-bubble ${isMine ? 'message-sent' : 'message-received'}`;
    div.id = imageId;
    
    div.innerHTML = `
        <div class="message-name">${isMine ? 'You' : sender}</div>
        <div class="image-container" onclick="viewFullImage('${imageId}')">
            <img src="${imageData}" class="chat-image" loading="lazy">
            <div class="image-timer" id="timer_${imageId}">10:00</div>
        </div>
        <div class="image-actions">
            <button class="download-btn" onclick="saveToGallery('${imageId}')">💾 Save</button>
            <button class="delete-btn" onclick="deleteImage('${imageId}')">🗑️</button>
        </div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    // Start 10-minute timer
    startImageTimer(imageId);
}

function startImageTimer(imageId) {
    const deleteTime = Date.now() + 600000; // 10 minutes
    
    const interval = setInterval(() => {
        const timeLeft = Math.max(0, deleteTime - Date.now());
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        const timerEl = document.getElementById(`timer_${imageId}`);
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 30000) { // Last 30 seconds - turn red
                timerEl.style.background = '#ff4444';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            deleteImage(imageId);
        }
    }, 1000);
}

function deleteImage(imageId) {
    const element = document.getElementById(imageId);
    if (element) {
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s';
        setTimeout(() => element.remove(), 300);
        addSystemMessage('🖼️ Image auto-deleted');
    }
}

function saveToGallery(imageId) {
    const element = document.getElementById(imageId);
    if (!element) return;
    
    const img = element.querySelector('img');
    if (!img) return;
    
    // Create download link
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `syncware_${imageId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // For mobile - share API
    if (navigator.share) {
        // Optional: Use Web Share API
    }
    
    addSystemMessage('💾 Image saved to your device!');
}

function viewFullImage(imageId) {
    const element = document.getElementById(imageId);
    if (!element) return;
    
    const img = element.querySelector('img');
    if (!img) return;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
    `;
    
    const fullImg = document.createElement('img');
    fullImg.src = img.src;
    fullImg.style.cssText = 'max-width: 95%; max-height: 95%; border-radius: 10px;';
    
    overlay.appendChild(fullImg);
    overlay.onclick = () => document.body.removeChild(overlay);
    document.body.appendChild(overlay);
}

// ==================== WORKING CALLS ====================

async function startCall(callType) {
    if (!remoteUserId) {
        alert('No one else is connected! Wait for your partner to join.');
        return;
    }
    
    currentCallType = callType;
    
    try {
        // Request permissions with audio always, video optional
        const constraints = {
            audio: true,
            video: callType === 'video' ? { width: 640, height: 480 } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        document.getElementById('callScreen').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('callStatus').textContent = 'Calling... 📞';
        
        // Create peer connection
        await createPeerConnection();
        
        // Add tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send call start with offer
        ws.send(JSON.stringify({
            type: 'call-start',
            targetUserId: remoteUserId,
            callType: callType
        }));
        
        ws.send(JSON.stringify({
            type: 'call-offer',
            targetUserId: remoteUserId,
            offer: offer
        }));
        
    } catch (error) {
        console.error('Call error:', error);
        
        if (error.name === 'NotAllowedError') {
            alert('Please allow camera/microphone access to make calls!');
        } else if (error.name === 'NotFoundError') {
            alert('No camera or microphone found on your device.');
        } else {
            alert('Failed to start call. Please try again.');
        }
        
        endCall();
    }
}

async function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteUserId) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                targetUserId: remoteUserId,
                candidate: event.candidate
            }));
        }
    };
    
    peerConnection.ontrack = (event) => {
        console.log('Got remote track!');
        const remoteVideo = document.getElementById('remoteVideo');
        remoteVideo.srcObject = event.streams[0];
        document.getElementById('callStatus').textContent = 'Connected! 📞';
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'disconnected' || 
            peerConnection.iceConnectionState === 'failed') {
            endCall();
        }
    };
}

function handleIncomingCall(data) {
    currentCallType = data.callType;
    remoteUserId = data.fromUserId;
    
    document.getElementById('callerName').textContent = data.fromUsername;
    document.getElementById('callType').textContent = data.callType === 'video' ? '📹 Video Call' : '📞 Voice Call';
    document.getElementById('incomingCall').style.display = 'block';
    
    // Auto-ring sound (optional)
    playRingtone();
}

async function acceptCall() {
    document.getElementById('incomingCall').style.display = 'none';
    stopRingtone();
    
    try {
        const constraints = {
            audio: true,
            video: currentCallType === 'video' ? { width: 640, height: 480 } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        document.getElementById('callScreen').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('callStatus').textContent = 'Connecting...';
        
        await createPeerConnection();
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        ws.send(JSON.stringify({
            type: 'call-accept',
            targetUserId: remoteUserId
        }));
        
    } catch (error) {
        console.error('Accept call error:', error);
        alert('Failed to accept call. Check camera/microphone permissions.');
        endCall();
    }
}

function rejectCall() {
    document.getElementById('incomingCall').style.display = 'none';
    stopRingtone();
    
    ws.send(JSON.stringify({
        type: 'call-reject',
        targetUserId: remoteUserId
    }));
}

async function handleCallOffer(data) {
    if (!peerConnection) {
        await createPeerConnection();
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    ws.send(JSON.stringify({
        type: 'call-answer',
        targetUserId: data.fromUserId,
        answer: answer
    }));
}

async function handleCallAnswer(data) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        document.getElementById('callStatus').textContent = 'Connected! 📞';
    }
}

async function handleICECandidate(data) {
    if (peerConnection && data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('ICE candidate error:', error);
        }
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    document.getElementById('callScreen').style.display = 'none';
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('remoteVideo').srcObject = null;
    
    if (remoteUserId) {
        ws.send(JSON.stringify({
            type: 'call-end',
            targetUserId: remoteUserId
        }));
    }
    
    stopRingtone();
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            document.querySelector('.mute-btn').textContent = audioTrack.enabled ? '🎤' : '🔇';
        }
    }
}

// ==================== RINGTONE ====================

let ringtoneInterval = null;

function playRingtone() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        ringtoneInterval = setInterval(() => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        }, 400);
    } catch (e) {
        console.log('Ringtone not supported');
    }
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
}

// ==================== HELPERS ====================

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

console.log('⚡ Syncware 2.0 Fast Edition loaded!');
