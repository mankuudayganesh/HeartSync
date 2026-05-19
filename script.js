// Backend URL - CHANGE THIS to your actual Render backend URL
const BACKEND_URL = 'wss://heartsync-backend-8fta.onrender.com';

let ws = null;
let myName = '';
let myUserId = '';
let localStream = null;
let peerConnection = null;
let currentCallType = null;
let remoteUserId = null;
let isCaller = false;
let callAccepted = false;

// ==================== QUICK CONNECT ====================

function startChat() {
    myName = document.getElementById('nameInput').value.trim();
    
    if (!myName) {
        alert('Please enter your name!');
        return;
    }

    const btn = document.getElementById('startBtn');
    btn.textContent = 'Connecting...';
    btn.disabled = true;

    ws = new WebSocket(BACKEND_URL);

    ws.onopen = () => {
        console.log('⚡ Connected!');
        
        ws.send(JSON.stringify({
            type: 'join',
            username: myName
        }));

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('chatScreen').style.display = 'flex';
        
        addSystemMessage('Connected! Waiting for partner... 💑');
        
        // Focus input immediately
        document.getElementById('messageInput').focus();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
            myUserId = data.userId;
        } else {
            handleMessage(data);
        }
    };

    ws.onerror = () => {
        alert('Connection failed. Server might be waking up. Try again in 30 seconds.');
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
            remoteUserId = data.userId;
            document.querySelector('.status').textContent = `🟢 ${data.username} online`;
            break;
            
        case 'user-left':
            addSystemMessage(`${data.username} left 💔`);
            remoteUserId = null;
            document.querySelector('.status').textContent = '🟢 Waiting for partner...';
            break;
            
        case 'users-list':
            const otherUser = data.users.find(u => u.userId !== myUserId);
            if (otherUser) {
                remoteUserId = otherUser.userId;
                addSystemMessage(`${otherUser.username} is online! 🟢`);
                document.querySelector('.status').textContent = `🟢 ${otherUser.username} online`;
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
            callAccepted = true;
            document.getElementById('callStatus').textContent = 'Partner accepted! Connecting... 📞';
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
            
        case 'error':
            alert(data.message);
            break;
    }
}

// ==================== WHATSAPP-STYLE MESSAGING ====================

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
        type: 'message',
        username: myName,
        message: text
    }));
    
    // Add message and scroll to bottom like WhatsApp
    addMessage('You', text, getTime(), true);
    
    input.value = '';
    input.focus();
}

function addMessage(sender, text, time, isMine) {
    const container = document.getElementById('messagesContainer');
    
    // Check if we need a date separator
    addDateSeparatorIfNeeded(container);
    
    // Check if this message should be grouped with previous
    const shouldGroup = shouldGroupWithPrevious(container, isMine);
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${isMine ? 'message-out' : 'message-in'}`;
    
    const div = document.createElement('div');
    div.className = `message-bubble ${isMine ? 'message-sent' : 'message-received'}`;
    
    if (shouldGroup) {
        div.classList.add('grouped');
    }
    
    div.innerHTML = `
        ${!shouldGroup ? `<div class="message-name">${isMine ? 'You' : sender}</div>` : ''}
        <div class="message-text">${escapeHtml(text)}</div>
        <div class="message-meta">
            <span class="message-time">${time}</span>
            ${isMine ? '<span class="message-check">✓✓</span>' : ''}
        </div>
    `;
    
    messageWrapper.appendChild(div);
    container.appendChild(messageWrapper);
    
    // Scroll to bottom exactly like WhatsApp
    scrollToBottom(container);
}

function shouldGroupWithPrevious(container, isMine) {
    const lastWrapper = container.lastElementChild;
    if (!lastWrapper) return false;
    
    const lastBubble = lastWrapper.querySelector('.message-bubble');
    if (!lastBubble) return false;
    
    // Group if same sender (within 1 minute)
    const lastIsMine = lastBubble.classList.contains('message-sent');
    if (lastIsMine !== isMine) return false;
    
    // Check time difference
    const lastTimeEl = lastBubble.querySelector('.message-time');
    if (!lastTimeEl) return false;
    
    const lastTime = lastTimeEl.textContent;
    const currentTime = getTime();
    
    // Simple grouping: if last message was within last minute
    if (lastBubble.dataset.timestamp) {
        const diff = Date.now() - parseInt(lastBubble.dataset.timestamp);
        return diff < 60000; // 1 minute
    }
    
    return false;
}

function addDateSeparatorIfNeeded(container) {
    const today = new Date().toDateString();
    const lastSeparator = container.querySelector('.date-separator:last-child');
    
    if (!lastSeparator || lastSeparator.dataset.date !== today) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.dataset.date = today;
        separator.innerHTML = `<span>${formatDate(new Date())}</span>`;
        container.appendChild(separator);
    }
}

function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }
}

function scrollToBottom(container) {
    // Smooth scroll to bottom like WhatsApp
    requestAnimationFrame(() => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    });
}

// Scroll to bottom on load
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('messagesContainer');
    if (container) {
        scrollToBottom(container);
    }
});

// ==================== IMAGE WITH CAMERA & GALLERY ====================

function sendImage() {
    const overlay = document.createElement('div');
    overlay.id = 'imagePickerOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 20px; text-align: center; max-width: 300px; width: 90%; animation: slideUp 0.3s ease;">
            <h3 style="margin-bottom: 20px; color: #333;">Send Image 📸</h3>
            <button id="cameraBtn" style="display: block; width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 12px; font-size: 16px; cursor: pointer;">
                📷 Take Photo
            </button>
            <button id="galleryBtn" style="display: block; width: 100%; padding: 15px; margin-bottom: 10px; background: linear-gradient(135deg, #764ba2, #667eea); color: white; border: none; border-radius: 12px; font-size: 16px; cursor: pointer;">
                🖼️ Choose from Gallery
            </button>
            <button id="cancelImageBtn" style="display: block; width: 100%; padding: 12px; background: #f0f0f0; color: #333; border: none; border-radius: 12px; font-size: 14px; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('cameraBtn').onclick = () => {
        document.body.removeChild(overlay);
        openCamera();
    };
    
    document.getElementById('galleryBtn').onclick = () => {
        document.body.removeChild(overlay);
        openGallery();
    };
    
    document.getElementById('cancelImageBtn').onclick = () => {
        document.body.removeChild(overlay);
    };
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
}

function openCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) await processAndSendImage(file);
    };
    
    input.click();
}

function openGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) await processAndSendImage(file);
    };
    
    input.click();
}

async function processAndSendImage(file) {
    addSystemMessage('📤 Processing image...');
    
    try {
        const compressedImage = await compressImage(file, 800, 0.6);
        
        if (compressedImage.length > 500000) {
            alert('Image too large after compression. Try a smaller image.');
            return;
        }
        
        const imageId = 'img_' + Date.now();
        
        ws.send(JSON.stringify({
            type: 'image',
            username: myName,
            imageData: compressedImage,
            imageId: imageId
        }));
        
        addImageMessage('You', compressedImage, imageId, getTime(), true);
        
    } catch (error) {
        console.error('Image error:', error);
        alert('Failed to send image. Please try again.');
    }
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
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
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
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${isMine ? 'message-out' : 'message-in'}`;
    
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
            <button class="download-btn" onclick="event.stopPropagation(); saveToGallery('${imageId}')">💾 Save</button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteImage('${imageId}')">🗑️</button>
        </div>
        <div class="message-meta">
            <span class="message-time">${time}</span>
            ${isMine ? '<span class="message-check">✓✓</span>' : ''}
        </div>
    `;
    
    messageWrapper.appendChild(div);
    container.appendChild(messageWrapper);
    
    scrollToBottom(container);
    startImageTimer(imageId);
}

function startImageTimer(imageId) {
    const deleteTime = Date.now() + 600000;
    
    const interval = setInterval(() => {
        const timeLeft = Math.max(0, deleteTime - Date.now());
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        const timerEl = document.getElementById(`timer_${imageId}`);
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            if (timeLeft <= 30000) {
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
        const wrapper = element.closest('.message-wrapper');
        if (wrapper) {
            wrapper.style.opacity = '0';
            wrapper.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (wrapper.parentNode) wrapper.remove();
            }, 300);
        }
        addSystemMessage('🖼️ Image deleted');
    }
}

function saveToGallery(imageId) {
    const element = document.getElementById(imageId);
    if (!element) return;
    
    const img = element.querySelector('img');
    if (!img) return;
    
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `syncware_${imageId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addSystemMessage('💾 Image saved to device!');
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

// ==================== CRYSTAL CLEAR CALLS ====================

async function startCall(callType) {
    if (!remoteUserId) {
        alert('No partner connected! Wait for them to join first.');
        return;
    }
    
    currentCallType = callType;
    isCaller = true;
    callAccepted = false;
    
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1,
                latency: 0
            },
            video: callType === 'video' ? { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 }
            } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) {
            alert('No microphone found! Please check your device.');
            return;
        }
        console.log('🎤 Audio track:', audioTrack.label);
        
        document.getElementById('callScreen').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('callStatus').textContent = 'Calling... 📞';
        
        await createPeerConnection();
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        ws.send(JSON.stringify({
            type: 'call-start',
            targetUserId: remoteUserId,
            callType: callType
        }));
        
        setTimeout(async () => {
            try {
                const offer = await peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: callType === 'video'
                });
                await peerConnection.setLocalDescription(offer);
                
                ws.send(JSON.stringify({
                    type: 'call-offer',
                    targetUserId: remoteUserId,
                    offer: offer
                }));
            } catch (error) {
                console.error('Offer error:', error);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Call error:', error);
        if (error.name === 'NotAllowedError') {
            alert('Please allow microphone access to make calls!');
        } else {
            alert('Failed to start call. Error: ' + error.message);
        }
        endCall();
    }
}

async function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 2,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    const audioTransceiver = peerConnection.addTransceiver('audio', {
        direction: 'sendrecv',
        streams: []
    });
    
    if (audioTransceiver.setCodecPreferences) {
        const codecs = RTCRtpSender.getCapabilities('audio')?.codecs || [];
        const opusCodec = codecs.find(codec => 
            codec.mimeType === 'audio/opus' && codec.clockRate === 48000
        );
        if (opusCodec) {
            try {
                audioTransceiver.setCodecPreferences([opusCodec]);
                console.log('🎵 Opus HD codec set');
            } catch (e) {}
        }
    }
    
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
        console.log('📹 Got track:', event.track.kind);
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (event.track.kind === 'audio') {
            const remoteAudio = new Audio();
            remoteAudio.srcObject = new MediaStream([event.track]);
            remoteAudio.play().catch(e => console.log('Audio play error:', e));
        }
        
        if (event.track.kind === 'video') {
            remoteVideo.srcObject = event.streams[0];
        }
        
        document.getElementById('callStatus').textContent = 'Connected! 📞';
    };
    
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
            document.getElementById('callStatus').textContent = 'Connected! 📞';
        } else if (peerConnection.connectionState === 'failed') {
            endCall();
        }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected' || 
            peerConnection.iceConnectionState === 'failed') {
            endCall();
        }
    };
}

function handleIncomingCall(data) {
    currentCallType = data.callType;
    remoteUserId = data.fromUserId;
    isCaller = false;
    
    document.getElementById('callerName').textContent = data.fromUsername;
    document.getElementById('callType').textContent = data.callType === 'video' ? '📹 Video Call' : '📞 Voice Call';
    document.getElementById('incomingCall').style.display = 'block';
}

async function acceptCall() {
    document.getElementById('incomingCall').style.display = 'none';
    callAccepted = true;
    
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1,
                latency: 0
            },
            video: currentCallType === 'video' ? { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 }
            } : false
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
        console.error('Accept error:', error);
        alert('Failed to accept call. Error: ' + error.message);
        endCall();
    }
}

function rejectCall() {
    document.getElementById('incomingCall').style.display = 'none';
    ws.send(JSON.stringify({
        type: 'call-reject',
        targetUserId: remoteUserId
    }));
}

async function handleCallOffer(data) {
    console.log('📩 Received offer');
    remoteUserId = data.fromUserId;
    
    if (!peerConnection) {
        await createPeerConnection();
        
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        ws.send(JSON.stringify({
            type: 'call-answer',
            targetUserId: data.fromUserId,
            answer: answer
        }));
        
    } catch (error) {
        console.error('Offer handling error:', error);
    }
}

async function handleCallAnswer(data) {
    console.log('📩 Received answer');
    
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            document.getElementById('callStatus').textContent = 'Connected! 📞';
        } catch (error) {
            console.error('Answer handling error:', error);
        }
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
    
    if (remoteUserId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'call-end',
            targetUserId: remoteUserId
        }));
    }
    
    isCaller = false;
    callAccepted = false;
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

// ==================== HELPERS ====================

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    container.appendChild(div);
    scrollToBottom(container);
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

// Keep chat scrolled to bottom on window resize
window.addEventListener('resize', () => {
    const container = document.getElementById('messagesContainer');
    if (container) {
        scrollToBottom(container);
    }
});

// Initial scroll when chat screen becomes visible
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'chatScreen' && 
            mutation.target.style.display === 'flex') {
            const container = document.getElementById('messagesContainer');
            if (container) {
                setTimeout(() => scrollToBottom(container), 100);
            }
        }
    });
});

const chatScreen = document.getElementById('chatScreen');
if (chatScreen) {
    observer.observe(chatScreen, { 
        attributes: true, 
        attributeFilter: ['style'] 
    });
}
// ==================== MOBILE KEYBOARD FIX ====================

// Keep chat scrolled to bottom when keyboard opens
let initialHeight = window.innerHeight;

window.addEventListener('resize', () => {
    const container = document.getElementById('messagesContainer');
    if (container && document.getElementById('chatScreen').style.display === 'flex') {
        // Only scroll if keyboard is opening (height decreasing)
        if (window.innerHeight < initialHeight) {
            setTimeout(() => scrollToBottom(container), 100);
            setTimeout(() => scrollToBottom(container), 300);
        }
        initialHeight = window.innerHeight;
    }
});

// Focus input and scroll when chat screen appears
const chatObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'chatScreen' && 
            mutation.target.style.display === 'flex') {
            const input = document.getElementById('messageInput');
            const container = document.getElementById('messagesContainer');
            if (input) {
                setTimeout(() => {
                    input.focus();
                    if (container) scrollToBottom(container);
                }, 200);
            }
        }
    });
});

const chatScreenEl = document.getElementById('chatScreen');
if (chatScreenEl) {
    chatObserver.observe(chatScreenEl, { 
        attributes: true, 
        attributeFilter: ['style'] 
    });
}

// Prevent body scroll when chat is open
document.body.addEventListener('touchmove', function(e) {
    if (document.getElementById('chatScreen').style.display === 'flex') {
        // Allow scrolling only in messages container
    }
}, { passive: true });

console.log('⚡ Syncware loaded! WhatsApp-style chat with HD calls & images!');
