const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ roomId, gender }) => {
        rooms[roomId] = {
            players: [{ id: socket.id, gender, role: 'P1' }],
            currentTurn: 'P1'
        };
        socket.join(roomId);
        socket.emit('room-created', { roomId });
    });

    socket.on('join-room', ({ roomId, gender }) => {
        const room = rooms[roomId];

        if (!room) {
            return socket.emit('join-error', {
                title: 'Room Not Found! 🔍',
                message: 'This private room link is invalid or expired.'
            });
        }

        if (room.players.length >= 2) {
            return socket.emit('join-error', {
                title: 'Room Full! 🚫',
                message: 'This intimate Desire Room is strictly capped at 2 lovers.'
            });
        }

        const hostGender = room.players[0].gender;

        if (hostGender === 'girl' && gender === 'girl') {
            return socket.emit('join-error', {
                title: 'Oops Queens! 💅',
                message: 'Dual Girl Energy detected! Game requires 1 Boy & 1 Girl pairing.'
            });
        }

        if (hostGender === 'boy' && gender === 'boy') {
            return socket.emit('join-error', {
                title: 'Whoa Kings! 👑',
                message: 'Dual Bro Energy detected! Game requires 1 Boy & 1 Girl pairing.'
            });
        }

        room.players.push({ id: socket.id, gender, role: 'P2' });
        socket.join(roomId);

        io.to(roomId).emit('room-joined', {
            players: room.players,
            currentTurn: room.currentTurn
        });
    });

    socket.on('send-message', ({ roomId, msgData }) => {
        socket.to(roomId).emit('receive-message', msgData);
    });

    socket.on('spin-wheel', ({ roomId, type, promptText, spinnerRole }) => {
        io.to(roomId).emit('wheel-spun', {
            spinnerId: socket.id,
            spinnerRole,
            type,
            promptText
        });
    });

    // Close Modals Simultaneously Across Room
    socket.on('close-prompt-modal', ({ roomId }) => {
        io.to(roomId).emit('auto-close-prompt-modal');
    });

    // Task Completion Review Request
    socket.on('submit-task-for-review', ({ roomId, spinnerRole }) => {
        io.to(roomId).emit('auto-close-prompt-modal');
        io.to(roomId).emit('partner-task-review', { spinnerRole });
    });

    // Handle Review Result (Accept vs Needs Spice)
    socket.on('resolve-task-review', ({ roomId, approved, reviewerRole }) => {
        if (rooms[roomId]) {
            const nextTurn = (rooms[roomId].currentTurn === 'P1') ? 'P2' : 'P1';
            rooms[roomId].currentTurn = nextTurn;
            
            io.to(roomId).emit('task-review-resolved', {
                approved,
                reviewerRole,
                nextTurn
            });
        }
    });

    socket.on('system-event', ({ roomId, text }) => {
        io.to(roomId).emit('receive-system-event', { text });
    });

    socket.on('pass-turn', ({ roomId, nextTurn }) => {
        if (rooms[roomId]) {
            rooms[roomId].currentTurn = nextTurn;
            io.to(roomId).emit('turn-changed', { currentTurn: nextTurn });
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(roomId).emit('partner-left');
                if (room.players.length === 0) {
                    delete rooms[roomId];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🔥 Desire Room Server live on http://localhost:${PORT}`);
});