require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map();

const emitRoomStats = (roomId) => {
  const users = Array.from(rooms.get(roomId) || []);
  io.to(roomId).emit('roomStats', {
    roomId,
    userCount: users.length,
    activeUsers: users
  });
};

io.on('connection', (socket) => {
  // console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, roomId }) => {
    const roomNumber = parseInt(roomId);
    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 9999) {
      socket.emit('error', 'Invalid room number');
      return;
    }

    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(username);

    socket.emit('message', {
      username: 'System',
      text: `Welcome to room #${roomId}, ${username}!`,
      timestamp: Date.now(),
    });

    socket.to(roomId).emit('message', {
      username: 'System',
      text: `${username} has joined the room`,
      timestamp: Date.now(),
    });

    emitRoomStats(roomId);
  });

  socket.on('chatMessage', (msg) => {
    io.to(msg.roomId).emit('message', {
      username: msg.username,
      text: msg.text,
      timestamp: msg.timestamp,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('userLeft', (data) => {
    if (rooms.has(data.roomId)) {
      rooms.get(data.roomId).delete(data.username);
      emitRoomStats(data.roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
