const mongoose = require("mongoose");
const { verifyRoomToken } = require("../middleware/authMiddleware");
const Room = require("../models/Room");

function dbReady() {
  return mongoose.connection.readyState === 1;
}

/** In-memory cap per room before oldest events are dropped (RAM vs fidelity) */
const MAX_EVENTS_PER_ROOM = 8000;
const SAVE_DEBOUNCE_MS = 4000;

/**
 * Room-scoped collaboration: each socket joins `io` room `roomId`.
 * Prepares for Redis adapter by keeping logic free of global broadcast.
 */
function setupWhiteboardSocket(io) {
  const roomMeta = new Map();
  // roomId -> { history: [], saveTimer, revision }

  function getBucket(roomId) {
    if (!roomMeta.has(roomId))
      roomMeta.set(roomId, { history: [], saveTimer: null, revision: 0 });
    return roomMeta.get(roomId);
  }

  async function loadRoomHistory(roomId) {
    const bucket = getBucket(roomId);
    if (bucket.history.length > 0) return bucket;
    if (dbReady()) {
      const doc = await Room.findOne({ roomId }).lean();
      if (doc && Array.isArray(doc.strokes)) bucket.history = doc.strokes;
      bucket.revision = doc?.revision || 0;
    }
    return bucket;
  }

  function schedulePersist(roomId) {
    const bucket = getBucket(roomId);
    if (bucket.saveTimer) clearTimeout(bucket.saveTimer);
    bucket.saveTimer = setTimeout(async () => {
      bucket.saveTimer = null;
      if (!dbReady()) return;
      try {
        bucket.revision += 1;
        await Room.updateOne(
          { roomId },
          { $set: { strokes: bucket.history, revision: bucket.revision } }
        );
      } catch (e) {
        console.error("[socket] persist room", roomId, e.message);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function trimHistory(bucket) {
    if (bucket.history.length > MAX_EVENTS_PER_ROOM)
      bucket.history = bucket.history.slice(-MAX_EVENTS_PER_ROOM);
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("auth_required"));
    try {
      const payload = verifyRoomToken(token);
      socket.roomScope = payload;
      return next();
    } catch {
      return next(new Error("invalid_room_token"));
    }
  });

  io.on("connection", async (socket) => {
    const scope = socket.roomScope;
    const roomId = scope.roomId;
    const canDraw = scope.draw === true;
    const displayName = scope.displayName || "User";
    const role = scope.role || "editor";
    const userKey = scope.userId || scope.guestId || socket.id;

    await loadRoomHistory(roomId);
    const bucket = getBucket(roomId);

    socket.join(roomId);
    socket.data.collab = {
      roomId,
      userKey,
      displayName,
      role,
      canDraw,
    };

    io.to(roomId).emit("participants_update", {
      participants: buildParticipantList(io, roomId),
    });

    socket.emit("drawing_history", bucket.history);
    io.to(roomId).emit("user_count_update", countInRoom(io, roomId));

    // --- draw / erase (editors+host only) ---
    socket.on("draw", (drawData) => {
      if (!socket.data.collab.canDraw) return;
      const evt = {
        ...drawData,
        socketId: socket.id,
        userKey,
        timestamp: new Date().toISOString(),
      };
      bucket.history.push(evt);
      trimHistory(bucket);
      schedulePersist(roomId);
      socket.to(roomId).emit("remote_draw", evt);
    });

    socket.on("erase", (eraseData) => {
      if (!socket.data.collab.canDraw) return;
      const evt = {
        ...eraseData,
        socketId: socket.id,
        userKey,
        timestamp: new Date().toISOString(),
      };
      bucket.history.push(evt);
      trimHistory(bucket);
      schedulePersist(roomId);
      socket.to(roomId).emit("remote_erase", evt);
    });

    socket.on("clear_board", async () => {
      if (socket.data.collab.role !== "host") return;
      bucket.history = [];
      schedulePersist(roomId);
      io.to(roomId).emit("board_cleared", { clearedBy: socket.id });
    });

    /** Remove last stroke segment from this socket only (simple collab undo). */
    socket.on("undo_last", () => {
      if (!socket.data.collab.canDraw) return;
      for (let i = bucket.history.length - 1; i >= 0; i--) {
        if (bucket.history[i].socketId === socket.id) {
          bucket.history.splice(i, 1);
          break;
        }
      }
      schedulePersist(roomId);
      io.to(roomId).emit("full_resync", { strokes: bucket.history });
    });

    socket.on("cursor_move", (cursorData) => {
      socket.to(roomId).emit("remote_cursor", {
        ...cursorData,
        socketId: socket.id,
        displayName,
        userKey,
      });
    });

    socket.on("disconnect", () => {
      io.to(roomId).emit("user_disconnected", socket.id);
      io.to(roomId).emit("user_count_update", countInRoom(io, roomId));
      io.to(roomId).emit("participants_update", {
        participants: buildParticipantList(io, roomId),
      });
    });
  });
}

function countInRoom(io, roomId) {
  const set = io.sockets.adapter.rooms.get(roomId);
  return set ? set.size : 0;
}

function buildParticipantList(io, roomId) {
  const list = [];
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return list;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (!s?.data?.collab) continue;
    list.push({
      socketId,
      displayName: s.data.collab.displayName,
      role: s.data.collab.role,
    });
  }
  return list;
}

module.exports = { setupWhiteboardSocket };
