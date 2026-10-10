const socket = io();

let currentRoomCode = '';
let myPlayerId = '';
let isMyTurn = false;

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const displayCode = document.getElementById('display-code');
const errorMsg = document.getElementById('error-msg');

const spinBtn = document.getElementById('spin-btn');
const turnStatus = document.getElementById('turn-status');
const wheel = document.getElementById('wheel');
const promptBox = document.getElementById('prompt-box');
const promptTag = document.getElementById('prompt-tag');
const promptText = document.getElementById('prompt-text');
const doneBtn = document.getElementById('done-btn');
const levelSelect = document.getElementById('level-select');

// Create Room
document.getElementById('create-btn').addEventListener('click', () => {
    socket.emit('create_room');
});

// Join Room
document.getElementById('join-btn').addEventListener('click', () => {
    const code = document.getElementById('room-input').value.trim();
    if (code.length === 6) {
        socket.emit('join_room', code);
    } else {
        errorMsg.innerText = "Please enter a valid 6-digit room code!";
    }
});

// Room Created Listener
socket.on('room_created', ({ roomCode }) => {
    currentRoomCode = roomCode;
    myPlayerId = socket.id;
    lobbyScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    displayCode.innerText = roomCode;
});

// Player Joined & Game Start
socket.on('player_joined', ({ players, currentTurn }) => {
    myPlayerId = socket.id;
    waitingScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    updateTurnUI(currentTurn);
});

// Spin Wheel Request
spinBtn.addEventListener('click', () => {
    if (!isMyTurn) return;
    const selectedLevel = levelSelect.value;
    socket.emit('spin_wheel', { roomCode: currentRoomCode, level: selectedLevel });
});

// Receive Spin Result
socket.on('spin_result', ({ spunBy, type, prompt }) => {
    wheel.classList.add('spinning');
    spinBtn.disabled = true;

    setTimeout(() => {
        wheel.classList.remove('spinning');
        wheel.innerText = type === 'truth' ? '😇' : '😈';
        promptTag.innerText = type.toUpperCase();
        promptTag.style.background = type === 'truth' ? '#00b0ff' : '#ff2a75';
        promptText.innerText = prompt;
        promptBox.classList.remove('hidden');

        if (spunBy === myPlayerId) {
            doneBtn.classList.remove('hidden');
        } else {
            doneBtn.classList.add('hidden');
        }
    }, 1200);
});

// Complete Turn
doneBtn.addEventListener('click', () => {
    promptBox.classList.add('hidden');
    socket.emit('complete_turn', currentRoomCode);
});

// Turn Changed Listener
socket.on('turn_changed', ({ currentTurn }) => {
    updateTurnUI(currentTurn);
});

function updateTurnUI(currentTurn) {
    isMyTurn = (currentTurn === myPlayerId);
    if (isMyTurn) {
        turnStatus.innerText = "🎯 IT'S YOUR TURN! Spin the wheel.";
        turnStatus.style.color = "#00e676";
        spinBtn.disabled = false;
    } else {
        turnStatus.innerText = "⏳ Partner's Turn... Please wait.";
        turnStatus.style.color = "#ffb300";
        spinBtn.disabled = true;
    }
}

// Real-Time Chat System
document.getElementById('send-chat-btn').addEventListener('click', sendChat);
function sendChat() {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
        socket.emit('send_chat', { roomCode: currentRoomCode, text: input.value.trim() });
        input.value = '';
    }
}

socket.on('receive_chat', ({ sender, text }) => {
    const box = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.style.margin = "4px 0";
    msg.style.color = sender === socket.id ? "#00e676" : "#ff2a75";
    msg.innerText = (sender === socket.id ? "You: " : "Partner: ") + text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
});

// Errors & Disconnects
socket.on('error_msg', (msg) => { alert(msg); });
socket.on('partner_disconnected', () => {
    alert("Partner has disconnected from the room.");
    location.reload();
});