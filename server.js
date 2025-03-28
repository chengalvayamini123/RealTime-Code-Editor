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

function initializeRoomState(roomId) {
    if (!roomStates.has(roomId)) {
        roomStates.set(roomId, {
            code: '',
            output: '',
            lastUpdate: Date.now()
        });
    }
}

app.use(cors());
app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        initializeRoomState(roomId);
        
        const clients = getAllConnectedClients(roomId);
        
        // Notify everyone in the room about the new user
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        // Send current room state to the new user
        const roomState = roomStates.get(roomId);
        if (roomState && roomState.code) {
            socket.emit(ACTIONS.SYNC_CODE, { code: roomState.code });
            if (roomState.output) {
                socket.emit(ACTIONS.OUTPUT_CHANGE, { output: roomState.output });
            }
        }
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        if (roomStates.has(roomId)) {
            roomStates.get(roomId).code = code;
            roomStates.get(roomId).lastUpdate = Date.now();
        }
        socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ roomId }) => {
        if (roomStates.has(roomId)) {
            const { code } = roomStates.get(roomId);
            socket.emit(ACTIONS.SYNC_CODE, { code });
        }
    });

    socket.on(ACTIONS.OUTPUT_CHANGE, ({ roomId, output }) => {
        if (roomStates.has(roomId)) {
            roomStates.get(roomId).output = output;
        }
        socket.to(roomId).emit(ACTIONS.OUTPUT_CHANGE, { output });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

// Clean up inactive rooms periodically
setInterval(() => {
    const now = Date.now();
    for (const [roomId, state] of roomStates.entries()) {
        if (now - state.lastUpdate > 24 * 60 * 60 * 1000) { // 24 hours
            roomStates.delete(roomId);
        }
    }
}, 60 * 60 * 1000); // Check every hour

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Waiting for client connections...');
});