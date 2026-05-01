const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const { signRoomToken } = require("../middleware/authMiddleware");

const router = express.Router();

const DB_UNAVAILABLE =
  process.env.RENDER
    ? "Database unavailable. Set MONGODB_URI in Render → Environment to your MongoDB Atlas connection string, then redeploy or restart the service."
    : "Database unavailable. Set MONGODB_URI in backend/.env to your MongoDB connection string, then restart the server.";

function dbReady() {
  return mongoose.connection.readyState === 1;
}

/** Anyone can create a room; optional password protects joins. Returns host room JWT. */
router.post("/", async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: DB_UNAVAILABLE });
    const { password, title, displayName: hostName } = req.body || {};
    const hostDisplay = hostName != null ? String(hostName).trim() : "";
    if (!hostDisplay)
      return res.status(400).json({ error: "Display name is required" });
    const roomId = crypto.randomUUID();
    const firstPageId = crypto.randomUUID();
    let passwordHash = null;
    if (password && String(password).length > 0)
      passwordHash = await bcrypt.hash(String(password), 10);
    const hostSessionId = crypto.randomUUID();
    await Room.create({
      roomId,
      hostUserId: null,
      passwordHash,
      title: title ? String(title).slice(0, 120) : "Untitled board",
      strokes: [],
      canvasPages: [{ id: firstPageId, title: "Page 1" }],
      revision: 0,
    });
    const roomToken = signRoomToken({
      roomId,
      guestId: hostSessionId,
      role: "host",
      draw: true,
      displayName: hostDisplay.slice(0, 48),
    });
    return res.status(201).json({
      roomId,
      roomToken,
      title: title || "Untitled board",
      invitePath: `/room/${roomId}`,
    });
  } catch (e) {
    console.error("[rooms/create]", e);
    return res.status(500).json({ error: "Could not create room" });
  }
});

/**
 * Join a room (editor/viewer). Verifies optional room password.
 * Security = room UUID + optional room password + short-lived room JWT for sockets.
 */
router.post("/:roomId/join", async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: DB_UNAVAILABLE });
    const { roomId } = req.params;
    const { password, displayName, role: requestedRole } = req.body || {};
    const joinName = displayName != null ? String(displayName).trim() : "";
    if (!joinName)
      return res.status(400).json({ error: "Display name is required" });
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.passwordHash) {
      if (!password || !(await bcrypt.compare(String(password), room.passwordHash)))
        return res.status(403).json({ error: "Invalid room password" });
    }
    const guestId = crypto.randomUUID();
    const role = requestedRole === "viewer" ? "viewer" : "editor";
    const roomToken = signRoomToken({
      roomId,
      guestId,
      role,
      draw: role !== "viewer",
      displayName: joinName.slice(0, 48),
    });
    return res.json({ roomId, roomToken, role });
  } catch (e) {
    console.error("[rooms/join]", e);
    return res.status(500).json({ error: "Could not join room" });
  }
});

module.exports = router;
