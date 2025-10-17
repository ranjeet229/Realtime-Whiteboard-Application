const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // For full accessibility; restrict in real deployments!
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

let activeUsers = new Map(); // socketId -> userData
let drawingHistory = {};     // roomId -> [events]

function getRoomId(userData = {}) {
  return userData.roomType === 'private' && userData.passKey
    ? userData.passKey.trim()
    : 'public';
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins a room
  socket.on('user_join', (userData) => {
    const roomId = getRoomId(userData);
    socket.join(roomId);
    activeUsers.set(socket.id, {
      id: socket.id,
      ...userData,
      roomId,
      joinedAt: new Date()
    });

    if (!drawingHistory[roomId]) drawingHistory[roomId] = [];

    // Send only this room's history
    socket.emit('drawing_history', drawingHistory[roomId]);

    // Only users in this room
    const userCount = Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length;
    io.to(roomId).emit('user_count_update', userCount);

    console.log(
      `User ${userData.username || socket.id} joined [room: ${roomId}]. Users: ${userCount}`
    );
  });

  // Draw
  socket.on('draw', (drawData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const drawingEvent = {
      ...drawData,
      socketId: socket.id,
      timestamp: new Date(),
    };
    drawingHistory[roomId] = drawingHistory[roomId] || [];
    drawingHistory[roomId].push(drawingEvent);

    // History limit
    if (drawingHistory[roomId].length > 1000)
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);

    socket.to(roomId).emit('remote_draw', drawingEvent);
  });

  // Erase
  socket.on('erase', (eraseData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const eraseEvent = {
      ...eraseData,
      socketId: socket.id,
      timestamp: new Date(),
    };
    drawingHistory[roomId] = drawingHistory[roomId] || [];
    drawingHistory[roomId].push(eraseEvent);

    if (drawingHistory[roomId].length > 1000)
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);

    socket.to(roomId).emit('remote_erase', eraseEvent);
  });

  // Clear
  socket.on('clear_board', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    drawingHistory[roomId] = [];
    io.to(roomId).emit('board_cleared', { clearedBy: socket.id });
  });

  // Cursor movement
  socket.on('cursor_move', (cursorData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    socket.to(roomId).emit('remote_cursor', {
      ...cursorData,
      socketId: socket.id
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { roomId } = user;
      activeUsers.delete(socket.id);
      const userCount = Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length;
      io.to(roomId).emit('user_count_update', userCount);
      socket.to(roomId).emit('user_disconnected', socket.id);
      console.log(`User disconnected: ${socket.id} (room: ${roomId})`);
    } else {
      activeUsers.delete(socket.id);
    }
  });
});

// Health check
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
  console.log(`Health: http://localhost:${PORT}/health`);
});
