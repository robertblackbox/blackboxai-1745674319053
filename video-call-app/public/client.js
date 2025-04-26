// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const leaveBtn = document.getElementById('leaveBtn');

// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

let socket;
let localStream;
let peerConnection;
let roomId;
let isAudioMuted = false;
let isVideoOff = false;

// Initialize the application
async function init() {
    socket = io();
    setupSocketListeners();
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Unable to access camera and microphone');
    }
}

// Set up Socket.io event listeners
function setupSocketListeners() {
    socket.on('user-connected', async () => {
        console.log('Another user joined the room');
        await createOffer();
    });

    socket.on('offer', async (offer) => {
        if (!peerConnection) {
            await createPeerConnection();
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, roomId);
    });

    socket.on('answer', async (answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async (candidate) => {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

// Create and set up WebRTC peer connection
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, roomId);
        }
    };
}

// Create and send offer to remote peer
async function createOffer() {
    await createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer, roomId);
}

// Join a room
async function joinRoom() {
    roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    socket.emit('join-room', roomId);
    joinBtn.disabled = true;
    joinBtn.classList.add('opacity-50');
}

// Toggle audio
function toggleAudio() {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    muteBtn.innerHTML = isAudioMuted ? 
        '<i class="fas fa-microphone-slash text-red-500 text-xl"></i>' : 
        '<i class="fas fa-microphone text-white text-xl"></i>';
}

// Toggle video
function toggleVideo() {
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks()[0].enabled = !isVideoOff;
    videoBtn.innerHTML = isVideoOff ? 
        '<i class="fas fa-video-slash text-red-500 text-xl"></i>' : 
        '<i class="fas fa-video text-white text-xl"></i>';
}

// Leave the call
function leaveCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (socket) {
        socket.disconnect();
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    joinBtn.disabled = false;
    joinBtn.classList.remove('opacity-50');
    window.location.reload();
}

// Event listeners
joinBtn.addEventListener('click', joinRoom);
muteBtn.addEventListener('click', toggleAudio);
videoBtn.addEventListener('click', toggleVideo);
leaveBtn.addEventListener('click', leaveCall);

// Initialize when the page loads
init();
