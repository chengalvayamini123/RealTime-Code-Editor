const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const cors = require('cors');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5000"],
        methods: ["GET", "POST"]
    }
});

// Store active rooms and their states
const roomStates = new Map();
const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

function getRoomState(roomId) {
    return roomStates.get(roomId) || {};
}

function updateRoomState(roomId, state) {
    roomStates.set(roomId, state);
}

io.on('connection', (socket) => {
    socket.on('join', ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit('joined', {
                clients,
                username,
                socketId: socket.id,
            });
        });

        const roomState = getRoomState(roomId);
        if (roomState && roomState.code) {
            socket.emit('code-change', { code: roomState.code });
        }
    });

    socket.on('code-change', ({ roomId, code }) => {
        updateRoomState(roomId, { code });
        socket.in(roomId).emit('code-change', { code });
    });

    socket.on('sync-code', ({ socketId, code }) => {
        io.to(socketId).emit('code-change', { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit('disconnected', {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
    });
});

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'build')));

// For any other routes, return the React index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
