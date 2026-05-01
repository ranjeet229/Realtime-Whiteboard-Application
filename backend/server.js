const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.warn(
    "[config] JWT_SECRET is not set — authentication and Socket.IO room tokens will fail."
  );
}

const { connectDb } = require("./config/db");
const roomRoutes = require("./routes/roomRoutes");
const { setupWhiteboardSocket } = require("./socket/whiteboardSocket");

const app = express();
const server = http.createServer(app);

/** Strip trailing slashes so browser Origin matches (browsers never send trailing /). */
function normalizeOrigin(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

/**
 * Allowed browser origins = CORS_ORIGINS (comma-separated) ∪ {FRONTEND_URL}.
 * Both env vars are merged so production Vercel URL in FRONTEND_URL still works
 * if CORS_ORIGINS was left as localhost-only.
 */
function buildAllowedOrigins() {
  const parts = [];
  if (process.env.CORS_ORIGINS) {
    parts.push(...process.env.CORS_ORIGINS.split(","));
  }
  if (process.env.FRONTEND_URL) {
    parts.push(process.env.FRONTEND_URL);
  }
  const seen = new Set();
  const list = [];
  for (const p of parts) {
    const n = normalizeOrigin(p);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    list.push(n);
  }
  if (list.length === 0) {
    list.push("http://localhost:3000");
  }
  return list;
}

const allowedOrigins = buildAllowedOrigins();

if (process.env.RENDER && !allowedOrigins.some((o) => /^https:/i.test(o))) {
  console.warn(
    "[cors] Render detected but no https:// origin in FRONTEND_URL / CORS_ORIGINS — " +
      "set e.g. https://canvasquill.vercel.app or preflight will fail in the browser."
  );
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

app.use("/api/rooms", roomRoutes);

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState;
  const mongo =
    state === 1 ? "connected" : state === 2 ? "connecting" : "disconnected";
  res.json({
    status: "OK",
    service: "whiteboard-api",
    mongo,
    database: mongoose.connection.name || null,
  });
});

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

setupWhiteboardSocket(io);

const PORT = process.env.PORT || 5000;

(async () => {
  const dbOk = await connectDb();
  if (!dbOk) {
    console.warn(
      "[startup] Room API will return errors until MongoDB connects — set MONGODB_URI in .env"
    );
  }
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log("[cors] allowed origins:", allowedOrigins.join(", ") || "(none)");
  });
})();
