const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not configured");
  return s;
}

/**
 * Room-scoped token: used for Socket.IO handshake after join/create.
 * draw: false for viewer role.
 */
function signRoomToken(payload) {
  return jwt.sign(
    {
      type: "room",
      roomId: payload.roomId,
      userId: payload.userId || null,
      guestId: payload.guestId || null,
      role: payload.role,
      draw: payload.draw !== false,
      displayName: payload.displayName || "Guest",
    },
    getJwtSecret(),
    { expiresIn: process.env.ROOM_TOKEN_EXPIRES_IN || "7d" }
  );
}

function verifyRoomToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (payload.type !== "room") throw new Error("not_room");
  return payload;
}

module.exports = {
  signRoomToken,
  verifyRoomToken,
  getJwtSecret,
};
