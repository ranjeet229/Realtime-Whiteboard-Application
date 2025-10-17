const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // Adjust as needed!
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

let activeUsers = new Map(); // socketId -> userData
let drawingHistory = {};     // roomId -> [events]
let undoStacks = {};         // roomId -> [{ action: 'push'|'clear', event: ... }]

// Helper
function getRoomId(userData = {}) {
  return userData.roomType === 'private' && userData.passKey
    ? userData.passKey.trim()
    : 'public';
}

io.on('connection', (socket) => {
  // ---- Whiteboard join logic -----
  socket.on('user_join', (userData) => {
    const roomId = getRoomId(userData);
    socket.join(roomId);
    activeUsers.set(socket.id, {
      id: socket.id,
      ...userData,
      roomId,
      joinedAt: new Date(),
      username: userData.username || `User_${socket.id.substring(0, 6)}`
    });

    // Drawing history init
    if (!drawingHistory[roomId]) drawingHistory[roomId] = [];
    if (!undoStacks[roomId]) undoStacks[roomId] = [];

    // Send current state
    socket.emit('drawing_history', drawingHistory[roomId]);
    io.to(roomId).emit('user_count_update', Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length);
  });

  // ---- Drawing ----
  socket.on('draw', (drawData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const drawingEvent = {
      ...drawData,
      socketId: socket.id,
      timestamp: new Date(),
      username: user.username || ''
    };
    drawingHistory[roomId].push(drawingEvent);
    undoStacks[roomId].push({ action: 'push', event: drawingEvent });
    if (drawingHistory[roomId].length > 1000) {
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);
    }
    socket.to(roomId).emit('remote_draw', drawingEvent);
  });

  // ---- Erase ----
  socket.on('erase', (eraseData) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    const eraseEvent = {
      ...eraseData,
      socketId: socket.id,
      timestamp: new Date(),
      username: user.username || ''
    };
    drawingHistory[roomId].push(eraseEvent);
    undoStacks[roomId].push({ action: 'push', event: eraseEvent });
    if (drawingHistory[roomId].length > 1000) {
      drawingHistory[roomId] = drawingHistory[roomId].slice(-1000);
    }
    socket.to(roomId).emit('remote_erase', eraseEvent);
  });

  // ---- Clear Board ----
  socket.on('clear_board', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    undoStacks[roomId].push({ action: 'clear', events: [...drawingHistory[roomId]] });
    drawingHistory[roomId] = [];
    io.to(roomId).emit('board_cleared', { clearedBy: socket.id });
  });

  // ---- Undo ----
  socket.on('undo', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const { roomId } = user;
    if (!undoStacks[roomId] || undoStacks[roomId].length === 0) return;

    // Pop off last item
    let popped;
    while (undoStacks[roomId].length > 0) {
      const last = undoStacks[roomId].pop();
      if (last.action === 'push') {
        // Remove from end of drawingHistory
        drawingHistory[roomId].pop();
        popped = last;
        break;
      }
      if (last.action === 'clear') {
        // Restore cleared events
        drawingHistory[roomId] = last.events || [];
        popped = last;
        break;
      }
    }
    // Send new state to all users in the room
    io.to(roomId).emit('drawing_history', drawingHistory[roomId]);
  });

  // ---- Redo ----
  // (To keep it simple, skipping redo stack for this version. Can be added per room if needed.)

  // ---- Chat ----
  socket.on('chat_message', ({ name, text }) => {
    const user = activeUsers.get(socket.id);
    const roomId = user ? user.roomId : 'public';
    io.to(roomId).emit('chat_message', {
      name: name || (user && user.username) || 'User',
      text,
      timestamp: Date.now()
    });
  });

  // ---- Disconnect logic ----
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { roomId } = user;
      activeUsers.delete(socket.id);
      io.to(roomId).emit('user_count_update', Array.from(activeUsers.values()).filter(u => u.roomId === roomId).length);
      socket.to(roomId).emit('user_disconnected', socket.id);
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
