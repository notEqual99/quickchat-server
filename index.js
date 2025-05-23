const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Store active rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle joining a room
  socket.on('joinRoom', ({ username, roomId }) => {
    // Validate room ID (1-9999)
    const roomNumber = parseInt(roomId);
    console.log('roomNumber', roomNumber);
    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 9999) {
      socket.emit('error', 'Invalid room number');
      return;
    }

    // Join the room
    socket.join(roomId);
    
    // Add user to the room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(username);

    // Send welcome message to the user
    socket.emit('message', {
      username: 'System',
      text: `Welcome to room #${roomId}, ${username}!`,
      timestamp: Date.now(),
    });

    // Broadcast to room that a user has joined
    socket.to(roomId).emit('message', {
      username: 'System',
      text: `${username} has joined the room`,
      timestamp: Date.now(),
    });

    // Send updated user list to room
    io.to(roomId).emit('roomUsers', Array.from(rooms.get(roomId)));
  });

  // Handle chat messages
  socket.on('chatMessage', (msg) => {
    // Broadcast the message to everyone in the room
    io.to(msg.roomId).emit('message', {
      username: msg.username,
      text: msg.text,
      timestamp: msg.timestamp,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Note: In a real app, you'd track which user is in which room
    // and clean up when they disconnect
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
