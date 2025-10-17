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
    origin: "http://localhost:3000", // Update as required
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store active users and drawing data per room
let activeUsers = new Map();
// drawingHistory is now an object: { [roomId]: [events] }
let drawingHistory = {};

function roomIdFromData(userData = {}) {
  return userData.roomType === 'private' && userData.passKey
    ? userData.passKey.trim()
    : 'public';
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining a room
  socket.on('user_join', (userData) => {
    const roomId = roomIdFromData(userData);
    socket.join(roomId);

    activeUsers.set(socket.id, {
      id: socket.id,
      ...userData,
      roomId,
      joinedAt: new Date()
    });

    // Init room's drawing event log if needed
    if (!drawingHistory[roomId]) drawingHistory[roomId] = [];

    // Send room-limited drawing history
    socket.emit('drawing_history', drawingHistory[roomId]);

    // Broadcast user count to room
    const userCount = Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length;
    io.to(roomId).emit('user_count_update', userCount);

    console.log(
      `User ${userData.username || socket.id} joined [room: ${roomId}]. Users in this room: ${userCount}`
    );
  });

  // Drawing events
  socket.on('draw', (drawData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const drawingEvent = {
      ...drawData,
      socketId: socket.id,
      timestamp: new Date(),
      // Capture drawing meta
      shape: drawData.shape || 'free',
      pencilType: drawData.pencilType || 'solid',
      eraserSize: drawData.eraserSize || null,
    };
    drawingHistory[roomId] = drawingHistory[roomId] || [];
    drawingHistory[roomId].push(drawingEvent);

    // Limit history for memory protection
    if (drawingHistory[roomId].length > 1000)
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);

    // Broadcast to peers in same room
    socket.to(roomId).emit('remote_draw', drawingEvent);
  });

  // Erase events (use same meta if needed)
  socket.on('erase', (eraseData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const eraseEvent = {
      ...eraseData,
      socketId: socket.id,
      timestamp: new Date(),
      shape: eraseData.shape || 'free',
      eraserSize: eraseData.eraserSize || 20,
    };
    drawingHistory[roomId] = drawingHistory[roomId] || [];
    drawingHistory[roomId].push(eraseEvent);

    if (drawingHistory[roomId].length > 1000)
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);

    socket.to(roomId).emit('remote_erase', eraseEvent);
  });

  // Clear events
  socket.on('clear_board', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    drawingHistory[roomId] = [];
    io.to(roomId).emit('board_cleared', { clearedBy: socket.id });
  });

  // Cursor movement (if using)
  socket.on('cursor_move', (cursorData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    socket.to(roomId).emit('remote_cursor', {
      ...cursorData,
      socketId: socket.id
    });
  });

  // Disconnection
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { roomId } = user;
      activeUsers.delete(socket.id);

      // Broadcast updated user count to room
      const userCount = Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length;
      io.to(roomId).emit('user_count_update', userCount);

      // Remove user cursor
      socket.to(roomId).emit('user_disconnected', socket.id);
      console.log(`User disconnected: ${socket.id} (room: ${roomId})`);
    } else {
      activeUsers.delete(socket.id); // Fallback
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    activeUsers: activeUsers.size,
    drawingEvents: Object.values(drawingHistory).reduce((a, b) => a + b.length, 0),
    rooms: Object.keys(drawingHistory)
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`check: http://localhost:${PORT}/health`);
});
