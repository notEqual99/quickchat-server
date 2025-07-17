require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

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
const activeSessions = new Map(); // Track active sessions per user+room

const generateSessionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

const getSessionKey = (username, roomId) => {
  return `${username}:${roomId}`;
};

const emitRoomStats = (roomId) => {
  const users = Array.from(rooms.get(roomId) || []);
  io.to(roomId).emit('roomStats', {
    roomId,
    userCount: users.length,
    activeUsers: users
  });
};

const removeUserFromRoom = (socketId, username, roomId) => {
  const sessionKey = getSessionKey(username, roomId);
  const userInfo = userSockets.get(socketId);
  
  // Only remove if this socket owns the session
  if (userInfo && activeSessions.get(sessionKey)?.socketId === socketId) {
    activeSessions.delete(sessionKey);
    
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
  }

  userSockets.delete(socketId);
};

const kickExistingSession = (username, roomId, reason = 'Another session started') => {
  const sessionKey = getSessionKey(username, roomId);
  const existingSession = activeSessions.get(sessionKey);
  
  if (existingSession) {
    const existingSocket = io.sockets.sockets.get(existingSession.socketId);
    if (existingSocket) {
      existingSocket.emit('sessionKicked', {
        reason,
        timestamp: Date.now()
      });
      existingSocket.disconnect(true);
    }
  }
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('validateUsername', ({ username, roomId }) => {
    const roomNumber = parseInt(roomId);
    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 9999) {
      socket.emit('usernameValidation', { 
        valid: false, 
        error: 'Invalid room number' 
      });
      return;
    }

    const sessionKey = getSessionKey(username, roomId);
    const existingSession = activeSessions.get(sessionKey);
    
    if (existingSession) {
      // Check if the existing session is still active
      const existingSocket = io.sockets.sockets.get(existingSession.socketId);
      if (existingSocket && existingSocket.connected) {
        socket.emit('usernameValidation', { 
          valid: false, 
          error: 'This username is already active in this room from another session' 
        });
        return;
      } else {
        // Clean up stale session
        activeSessions.delete(sessionKey);
      }
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

    const sessionKey = getSessionKey(username, roomId);
    const existingSession = activeSessions.get(sessionKey);
    
    if (existingSession) {
      // Check if the existing session is still active
      const existingSocket = io.sockets.sockets.get(existingSession.socketId);
      if (existingSocket && existingSocket.connected) {
        socket.emit('error', 'This username is already active in this room from another session');
        return;
      } else {
        // Clean up stale session
        activeSessions.delete(sessionKey);
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(username);
        }
      }
    }

    // Generate session ID and create new session
    const sessionId = generateSessionId();
    activeSessions.set(sessionKey, {
      socketId: socket.id,
      sessionId,
      username,
      roomId,
      joinedAt: Date.now()
    });

    socket.join(roomId);
    userSockets.set(socket.id, { username, roomId, sessionId });
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(username);

    socket.emit('sessionEstablished', {
      sessionId,
      username,
      roomId
    });

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

  socket.on('heartbeat', ({ username, roomId, sessionId }) => {
    const sessionKey = getSessionKey(username, roomId);
    const session = activeSessions.get(sessionKey);
    
    if (session && session.socketId === socket.id && session.sessionId === sessionId) {
      // Session is valid, update last seen
      session.lastSeen = Date.now();
      socket.emit('heartbeatAck');
    } else {
      // Invalid session, kick the client
      socket.emit('sessionInvalid');
      socket.disconnect(true);
    }
  });

  socket.on('chatMessage', (msg) => {
    const userInfo = userSockets.get(socket.id);
    if (!userInfo) return;

    const sessionKey = getSessionKey(userInfo.username, userInfo.roomId);
    const session = activeSessions.get(sessionKey);
    
    // Verify the message is from the active session
    if (session && session.socketId === socket.id) {
      io.to(msg.roomId).emit('message', {
        username: msg.username,
        text: msg.text,
        timestamp: msg.timestamp,
      });
    }
  });

  socket.on('leaveRoom', ({ username, roomId }) => {
    // console.log(`User ${username} leaving room ${roomId}`);
    socket.leave(roomId);
    removeUserFromRoom(socket.id, username, roomId);
  });

  socket.on('disconnect', (reason) => {
    // console.log('User disconnected:', socket.id, 'Reason:', reason);
    
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { username, roomId } = userInfo;
      removeUserFromRoom(socket.id, username, roomId);
    }
  });

  socket.on('userLeft', (data) => {
    console.log(`User ${data.username} explicitly left room ${data.roomId}`);
    removeUserFromRoom(socket.id, data.username, data.roomId);
  });
});

// Clean up stale sessions periodically
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 60000; // 1 minute
  
  for (const [sessionKey, session] of activeSessions.entries()) {
    if (session.lastSeen && (now - session.lastSeen) > staleTimeout) {
      console.log(`Cleaning up stale session: ${sessionKey}`);
      const socket = io.sockets.sockets.get(session.socketId);
      if (socket) {
        socket.disconnect(true);
      }
      activeSessions.delete(sessionKey);
    }
  }
}, 30000); // Check every 30 seconds

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});