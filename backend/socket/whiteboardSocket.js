const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { verifyRoomToken } = require("../middleware/authMiddleware");
const Room = require("../models/Room");

const SHAPE_TOOL_TYPES = new Set([
  "line",
  "rectangle",
  "circle",
  "ellipse",
  "arrow",
  "triangle",
  "diamond",
  "roundRect",
  "star",
  "image",
  "text",
]);

const MAX_IMAGE_DATA_URL_CHARS = 4_500_000;

/** One movable group per shape; pen/erase segments chain by proximity + socket. */
function assignLegacyGroupIds(history) {
  if (!Array.isArray(history)) return;
  let chainId = null;
  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    if (s.groupId) {
      chainId = null;
      continue;
    }
    if (SHAPE_TOOL_TYPES.has(s.type)) {
      s.groupId = randomUUID();
      chainId = null;
      continue;
    }
    if (s.type !== "draw" && s.type !== "erase") {
      chainId = null;
      continue;
    }
    const prev = history[i - 1];
    const sameChain =
      prev &&
      (prev.type === "draw" || prev.type === "erase") &&
      prev.socketId === s.socketId &&
      Math.hypot(s.fromX - prev.toX, s.fromY - prev.toY) < 3;
    if (!sameChain) chainId = randomUUID();
    s.groupId = chainId;
  }
}

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
      roomMeta.set(roomId, {
        history: [],
        canvasPages: [],
        saveTimer: null,
        revision: 0,
        /** @type {Map<string, object[]>} userKey|socketId -> redo stack (in-memory only) */
        redoStacks: new Map(),
      });
    const b = roomMeta.get(roomId);
    if (!b.redoStacks) b.redoStacks = new Map();
    return b;
  }

  function clearRedoForKey(bucket, key) {
    if (!key || !bucket.redoStacks) return;
    bucket.redoStacks.set(key, []);
  }

  function strokeBelongsToUser(evt, userKey, socketId) {
    if (userKey && evt.userKey) return evt.userKey === userKey;
    return evt.socketId === socketId;
  }

  /** Re-insert removed events at their original indices (handles interleaved remote strokes). */
  function mergeRedoIntoHistory(current, removedPairs, socketId) {
    if (!Array.isArray(current) || !Array.isArray(removedPairs) || removedPairs.length === 0)
      return current;
    const sorted = [...removedPairs].sort((a, b) => a.index - b.index);
    const total = current.length + sorted.length;
    let ci = 0;
    let ri = 0;
    const out = [];
    for (let logical = 0; logical < total; logical++) {
      if (ri < sorted.length && sorted[ri].index === logical) {
        out.push({ ...sorted[ri].evt, socketId });
        ri++;
      } else if (ci < current.length) {
        out.push(current[ci++]);
      }
    }
    return out;
  }

  function validPageId(bucket, pageId) {
    return (
      typeof pageId === "string" &&
      Array.isArray(bucket.canvasPages) &&
      bucket.canvasPages.some((p) => p.id === pageId)
    );
  }

  /** Keep titles `Page 1` … `Page n` in list order (stable ids). */
  function renumberCanvasPageTitles(pages) {
    if (!Array.isArray(pages)) return;
    for (let i = 0; i < pages.length; i++) {
      pages[i].title = `Page ${i + 1}`;
    }
  }

  async function loadRoomHistory(roomId) {
    const bucket = getBucket(roomId);
    if (bucket.history.length > 0) return bucket;
    if (dbReady()) {
      const doc = await Room.findOne({ roomId }).lean();
      if (doc && Array.isArray(doc.strokes)) {
        bucket.history = doc.strokes;
        assignLegacyGroupIds(bucket.history);
      } else {
        bucket.history = [];
      }
      let pages = Array.isArray(doc?.canvasPages) ? [...doc.canvasPages] : [];
      if (!pages.length) {
        const pid = randomUUID();
        pages = [{ id: pid, title: "Page 1" }];
        for (const s of bucket.history) {
          if (!s.pageId) s.pageId = pid;
        }
      }
      bucket.canvasPages = pages;
      renumberCanvasPageTitles(bucket.canvasPages);
      const firstId = bucket.canvasPages[0]?.id;
      if (firstId) {
        for (const s of bucket.history) {
          if (!s.pageId) s.pageId = firstId;
        }
      }
      bucket.revision = doc?.revision || 0;
    } else if (!bucket.canvasPages?.length) {
      const pid = randomUUID();
      bucket.canvasPages = [{ id: pid, title: "Page 1" }];
      const firstId = pid;
      for (const s of bucket.history) {
        if (!s.pageId) s.pageId = firstId;
      }
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
          {
            $set: {
              strokes: bucket.history,
              canvasPages: bucket.canvasPages || [],
              revision: bucket.revision,
            },
          }
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

    socket.emit("drawing_history", {
      strokes: bucket.history,
      canvasPages: bucket.canvasPages || [],
    });
    io.to(roomId).emit("user_count_update", countInRoom(io, roomId));

    // --- draw / erase (editors+host only) ---
    socket.on("draw", (drawData) => {
      if (!socket.data.collab.canDraw) return;
      clearRedoForKey(bucket, userKey || socket.id);
      const firstPid = bucket.canvasPages[0]?.id;
      let pageId =
        typeof drawData?.pageId === "string" ? drawData.pageId : firstPid;
      if (!validPageId(bucket, pageId)) pageId = firstPid;
      if (
        drawData?.type === "image" &&
        typeof drawData?.dataUrl === "string" &&
        drawData.dataUrl.length > MAX_IMAGE_DATA_URL_CHARS
      ) {
        return;
      }
      const evt = {
        ...drawData,
        pageId,
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
      clearRedoForKey(bucket, userKey || socket.id);
      const firstPid = bucket.canvasPages[0]?.id;
      let pageId =
        typeof eraseData?.pageId === "string" ? eraseData.pageId : firstPid;
      if (!validPageId(bucket, pageId)) pageId = firstPid;
      const evt = {
        ...eraseData,
        pageId,
        socketId: socket.id,
        userKey,
        timestamp: new Date().toISOString(),
      };
      bucket.history.push(evt);
      trimHistory(bucket);
      schedulePersist(roomId);
      socket.to(roomId).emit("remote_erase", evt);
    });

    socket.on("add_canvas_page", () => {
      if (!socket.data.collab.canDraw) return;
      if (!Array.isArray(bucket.canvasPages)) bucket.canvasPages = [];
      bucket.canvasPages.push({ id: randomUUID(), title: "_" });
      renumberCanvasPageTitles(bucket.canvasPages);
      schedulePersist(roomId);
      io.to(roomId).emit("canvas_pages_updated", {
        canvasPages: bucket.canvasPages,
      });
    });

    socket.on("delete_canvas_page", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const pageId = payload?.pageId;
      if (typeof pageId !== "string") return;
      const pages = bucket.canvasPages;
      if (!Array.isArray(pages) || pages.length <= 1) return;
      const delIdx = pages.findIndex((p) => p.id === pageId);
      if (delIdx < 0) return;
      const beforeFirst = pages[0]?.id;
      bucket.canvasPages = pages.filter((p) => p.id !== pageId);
      const fallbackFirst = beforeFirst;
      bucket.history = bucket.history.filter((evt) => {
        const eff = evt.pageId || fallbackFirst;
        return eff !== pageId;
      });
      renumberCanvasPageTitles(bucket.canvasPages);
      trimHistory(bucket);
      schedulePersist(roomId);
      io.to(roomId).emit("canvas_page_deleted", {
        pageId,
        canvasPages: bucket.canvasPages,
        fallbackFirstId: fallbackFirst,
      });
    });

    socket.on("set_groups_page", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const pageId = payload?.pageId;
      if (!validPageId(bucket, pageId)) return;
      const ids = [
        ...new Set(
          (Array.isArray(payload?.groupIds) ? payload.groupIds : []).filter(
            (x) => typeof x === "string"
          )
        ),
      ];
      if (!ids.length) return;
      const idSet = new Set(ids);
      let changed = false;
      for (const evt of bucket.history) {
        if (evt.groupId && idSet.has(evt.groupId)) {
          evt.pageId = pageId;
          changed = true;
        }
      }
      if (!changed) return;
      schedulePersist(roomId);
      socket.to(roomId).emit("groups_page_changed", { groupIds: ids, pageId });
    });

    socket.on("resize_image_group", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const groupId = payload?.groupId;
      const fx = Number(payload?.fromX);
      const fy = Number(payload?.fromY);
      const tx = Number(payload?.toX);
      const ty = Number(payload?.toY);
      if (!groupId || typeof groupId !== "string") return;
      if (![fx, fy, tx, ty].every(Number.isFinite)) return;
      const sc =
        typeof payload?.imageScale === "number" &&
        Number.isFinite(payload.imageScale)
          ? Math.max(0.02, Math.min(80, payload.imageScale))
          : undefined;
      let changed = false;
      for (const evt of bucket.history) {
        if (evt.groupId === groupId && evt.type === "image") {
          evt.fromX = fx;
          evt.fromY = fy;
          evt.toX = tx;
          evt.toY = ty;
          if (sc !== undefined) evt.imageScale = sc;
          changed = true;
        }
      }
      if (!changed) return;
      schedulePersist(roomId);
      socket.to(roomId).emit("image_group_resized", {
        groupId,
        fromX: fx,
        fromY: fy,
        toX: tx,
        toY: ty,
        imageScale: sc,
      });
    });

    function applyMoveGroups(groupIds, dx, dy) {
      const idSet = new Set(
        (Array.isArray(groupIds) ? groupIds : [])
          .map((id) => (typeof id === "string" ? id : null))
          .filter(Boolean)
      );
      if (idSet.size === 0) return false;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
      if (Math.abs(dx) > 50000 || Math.abs(dy) > 50000) return false;
      let changed = false;
      for (const evt of bucket.history) {
        if (
          evt.groupId &&
          idSet.has(evt.groupId) &&
          typeof evt.fromX === "number" &&
          typeof evt.fromY === "number" &&
          typeof evt.toX === "number" &&
          typeof evt.toY === "number"
        ) {
          evt.fromX += dx;
          evt.fromY += dy;
          evt.toX += dx;
          evt.toY += dy;
          changed = true;
        }
      }
      return changed;
    }

    socket.on("move_group", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const groupId = payload?.groupId;
      const dx = Number(payload?.dx);
      const dy = Number(payload?.dy);
      if (!groupId || typeof groupId !== "string") return;
      const changed = applyMoveGroups([groupId], dx, dy);
      if (!changed) return;
      schedulePersist(roomId);
      socket.to(roomId).emit("groups_moved", {
        groupIds: [groupId],
        dx,
        dy,
      });
    });

    socket.on("move_groups", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const ids = [
        ...new Set(
          (Array.isArray(payload?.groupIds) ? payload.groupIds : []).filter(
            (x) => typeof x === "string"
          )
        ),
      ];
      const dx = Number(payload?.dx);
      const dy = Number(payload?.dy);
      const changed = applyMoveGroups(ids, dx, dy);
      if (!changed) return;
      schedulePersist(roomId);
      socket.to(roomId).emit("groups_moved", { groupIds: ids, dx, dy });
    });

    socket.on("delete_groups", (payload) => {
      if (!socket.data.collab.canDraw) return;
      const ids = [
        ...new Set(
          (Array.isArray(payload?.groupIds) ? payload.groupIds : []).filter(
            (x) => typeof x === "string"
          )
        ),
      ];
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const before = bucket.history.length;
      bucket.history = bucket.history.filter(
        (evt) => !evt.groupId || !idSet.has(evt.groupId)
      );
      if (bucket.history.length === before) return;
      trimHistory(bucket);
      schedulePersist(roomId);
      socket.to(roomId).emit("groups_deleted", { groupIds: ids });
    });

    socket.on("clear_board", async () => {
      if (socket.data.collab.role !== "host") return;
      bucket.history = [];
      if (bucket.redoStacks) bucket.redoStacks.clear();
      schedulePersist(roomId);
      io.to(roomId).emit("board_cleared", { clearedBy: socket.id });
    });

    /**
     * Undo one logical pointer stroke: all draw/erase segments with the same groupId
     * from the last stroke by this user (client sets one groupId per pointer down/up).
     */
    socket.on("undo_last", () => {
      if (!socket.data.collab.canDraw) return;
      const key = userKey || socket.id;

      let lastIdx = -1;
      for (let i = bucket.history.length - 1; i >= 0; i--) {
        if (strokeBelongsToUser(bucket.history[i], userKey, socket.id)) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx < 0) return;

      const anchor = bucket.history[lastIdx];
      const freestyleGroup =
        anchor.groupId &&
        (anchor.type === "draw" || anchor.type === "erase");

      let removedPairsAsc = [];

      if (freestyleGroup) {
        const gid = anchor.groupId;
        const collected = [];
        for (let i = bucket.history.length - 1; i >= 0; i--) {
          const evt = bucket.history[i];
          if (
            evt.groupId === gid &&
            (evt.type === "draw" || evt.type === "erase") &&
            strokeBelongsToUser(evt, userKey, socket.id)
          ) {
            collected.push({ index: i, evt });
          }
        }
        collected.sort((a, b) => b.index - a.index);
        for (const { index } of collected) {
          bucket.history.splice(index, 1);
        }
        removedPairsAsc = collected.slice().sort((a, b) => a.index - b.index);
      } else {
        const evt = bucket.history[lastIdx];
        removedPairsAsc = [{ index: lastIdx, evt }];
        bucket.history.splice(lastIdx, 1);
      }

      if (removedPairsAsc.length) {
        if (!bucket.redoStacks.has(key)) bucket.redoStacks.set(key, []);
        const stk = bucket.redoStacks.get(key);
        stk.push(removedPairsAsc);
        if (stk.length > 80) stk.shift();
      }

      schedulePersist(roomId);
      io.to(roomId).emit("full_resync", { strokes: bucket.history });
    });

    socket.on("redo_last", () => {
      if (!socket.data.collab.canDraw) return;
      const key = userKey || socket.id;
      const stk = bucket.redoStacks?.get(key);
      if (!stk?.length) return;
      const bundle = stk.pop();
      if (!bundle) return;
      if (Array.isArray(bundle)) {
        if (bundle.length === 0) return;
        bucket.history = mergeRedoIntoHistory(
          bucket.history,
          bundle,
          socket.id
        );
      } else {
        bucket.history.push({ ...bundle, socketId: socket.id });
      }
      trimHistory(bucket);
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
