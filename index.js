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
const userSockets = new Map();

const emitRoomStats = (roomId) => {
  const users = Array.from(rooms.get(roomId) || []);
  io.to(roomId).emit('roomStats', {
    roomId,
    userCount: users.length,
    activeUsers: users
  });
};

const removeUserFromRoom = (socketId, username, roomId) => {
  if (rooms.has(roomId)) {
    rooms.get(roomId).delete(username);
    
    if (rooms.get(roomId).size === 0) {
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit('message', {
        username: 'System',
        text: `${username} has left the room`,
        timestamp: Date.now(),
      });

      emitRoomStats(roomId);
    }
  }

  userSockets.delete(socketId);
};

io.on('connection', (socket) => {
  // console.log('A user connected:', socket.id);

  socket.on('validateUsername', ({ username, roomId }) => {
    const roomNumber = parseInt(roomId);
    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 9999) {
      socket.emit('usernameValidation', { 
        valid: false, 
        error: 'Invalid room number' 
      });
      return;
    }

    if (rooms.has(roomId) && rooms.get(roomId).has(username)) {
      socket.emit('usernameValidation', { 
        valid: false, 
        error: 'Username already taken in this room' 
      });
      return;
    }

    socket.emit('usernameValidation', { 
      valid: true 
    });
  });

  socket.on('joinRoom', ({ username, roomId }) => {
    const roomNumber = parseInt(roomId);
    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 9999) {
      socket.emit('error', 'Invalid room number');
      return;
    }

    if (rooms.has(roomId) && rooms.get(roomId).has(username)) {
      socket.emit('error', 'Username already taken in this room');
      return;
    }

    socket.join(roomId);

    userSockets.set(socket.id, { username, roomId });
    
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

  socket.on('leaveRoom', ({ username, roomId }) => {
    // console.log(`User ${username} leaving room ${roomId}`);
    socket.leave(roomId);
    removeUserFromRoom(socket.id, username, roomId);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    // console.log('User disconnected:', socket.id, 'Reason:', reason);
    
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { username, roomId } = userInfo;
      removeUserFromRoom(socket.id, username, roomId);
    }
  });

  socket.on('userLeft', (data) => {
    // console.log(`User ${data.username} explicitly left room ${data.roomId}`);
    removeUserFromRoom(socket.id, data.username, data.roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});