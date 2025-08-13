const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store active users and drawing data
let activeUsers = new Map();
let drawingHistory = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('user_join', (userData) => {
    activeUsers.set(socket.id, {
      id: socket.id,
      ...userData,
      joinedAt: new Date()
    });
    
    // Send current drawing history to new user
    socket.emit('drawing_history', drawingHistory);
    
    // Broadcast updated user count
    io.emit('user_count_update', activeUsers.size);
    
    console.log(`User ${userData.username || socket.id} joined. Total users: ${activeUsers.size}`);
  });

  // Handle drawing events
  socket.on('draw', (drawData) => {
    // Store drawing data
    const drawingEvent = {
      ...drawData,
      socketId: socket.id,
      timestamp: new Date()
    };
    
    drawingHistory.push(drawingEvent);
    
    // Limit history to prevent memory issues (keep last 1000 events)
    if (drawingHistory.length > 1000) {
      drawingHistory = drawingHistory.slice(-1000);
    }
    
    // Broadcast to all other users
    socket.broadcast.emit('remote_draw', drawingEvent);
  });

  // Handle erase events
  socket.on('erase', (eraseData) => {
    const eraseEvent = {
      ...eraseData,
      socketId: socket.id,
      timestamp: new Date()
    };
    
    drawingHistory.push(eraseEvent);
    
    if (drawingHistory.length > 1000) {
      drawingHistory = drawingHistory.slice(-1000);
    }
    
    socket.broadcast.emit('remote_erase', eraseEvent);
  });

  // Handle clear board
  socket.on('clear_board', () => {
    drawingHistory = [];
    io.emit('board_cleared', { clearedBy: socket.id });
  });

  // Handle cursor movement
  socket.on('cursor_move', (cursorData) => {
    socket.broadcast.emit('remote_cursor', {
      ...cursorData,
      socketId: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeUsers.delete(socket.id);
    
    // Broadcast updated user count
    io.emit('user_count_update', activeUsers.size);
    
    // Remove user cursor
    socket.broadcast.emit('user_disconnected', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    activeUsers: activeUsers.size,
    drawingEvents: drawingHistory.length 
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});