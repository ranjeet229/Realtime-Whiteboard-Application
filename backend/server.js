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

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
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
    methods: ["GET", "POST"],
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
  });
})();
