"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import Link from "next/link";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { IconSidebarClosed, IconSidebarOpen } from "./SidebarPanelIcons";
import {
  ToolRailIcon,
  IconFill,
  IconOutline,
} from "./WhiteboardToolIcons.jsx";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const SHAPE_TOOL_TYPES = [
  "line",
  "rectangle",
  "circle",
  "ellipse",
  "arrow",
  "triangle",
  "diamond",
  "roundRect",
  "star",
];

const FILL_CAPABLE_SHAPES = new Set([
  "rectangle",
  "circle",
  "ellipse",
  "triangle",
  "diamond",
  "roundRect",
  "star",
]);

/** Native `title` tooltips — one short label each */
const TOOL_HINTS = {
  pen: "Pen",
  eraser: "Eraser",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  ellipse: "Ellipse",
  arrow: "Arrow",
  triangle: "Triangle",
  diamond: "Diamond",
  roundRect: "Round rect",
  star: "Star",
};

const SWATCH_HINT = {
  "#000000": "Black",
  "#ef4444": "Red",
  "#3b82f6": "Blue",
  "#10b981": "Green",
  "#f59e0b": "Orange",
  "#8b5cf6": "Purple",
  "#f472b6": "Pink",
  "#facc15": "Yellow",
  "#22d3ee": "Cyan",
  "#94a3b8": "Grey",
};

function normalizedRect(fromX, fromY, toX, toY) {
  const x = Math.min(fromX, toX);
  const y = Math.min(fromY, toY);
  const w = Math.abs(toX - fromX);
  const h = Math.abs(toY - fromY);
  return { x, y, w, h };
}

function pathTriangle(ctx, x, y, w, h) {
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function pathDiamond(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.moveTo(cx, y);
  ctx.lineTo(x + w, cy);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(x, cy);
  ctx.closePath();
}

function pathStar(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.38;
  const n = 5;
  for (let i = 0; i < n * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function pathRoundedRect(ctx, x, y, w, h, cornerRadius) {
  const r = Math.min(cornerRadius, w / 2, h / 2);
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawOnCanvas(ctx, evt) {
  ctx.save();
  const filled =
    evt.filled === true && FILL_CAPABLE_SHAPES.has(evt.type);

  switch (evt.type) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(evt.fromX, evt.fromY);
      ctx.lineTo(evt.toX, evt.toY);
      ctx.strokeStyle = evt.color;
      ctx.lineWidth = evt.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.stroke();
      break;
    case "rectangle": {
      ctx.globalCompositeOperation = "source-over";
      const { x, y, w, h } = normalizedRect(
        evt.fromX,
        evt.fromY,
        evt.toX,
        evt.toY
      );
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "circle": {
      ctx.beginPath();
      const r = Math.hypot(evt.toX - evt.fromX, evt.toY - evt.fromY);
      ctx.arc(evt.fromX, evt.fromY, r, 0, 2 * Math.PI);
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    }
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(
        evt.fromX,
        evt.fromY,
        Math.abs(evt.toX - evt.fromX),
        Math.abs(evt.toY - evt.fromY),
        0,
        0,
        2 * Math.PI
      );
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    case "triangle":
    case "diamond":
    case "star":
    case "roundRect": {
      ctx.beginPath();
      const { x, y, w, h } = normalizedRect(
        evt.fromX,
        evt.fromY,
        evt.toX,
        evt.toY
      );
      if (evt.type === "triangle") pathTriangle(ctx, x, y, w, h);
      else if (evt.type === "diamond") pathDiamond(ctx, x, y, w, h);
      else if (evt.type === "star") pathStar(ctx, x, y, w, h);
      else
        pathRoundedRect(
          ctx,
          x,
          y,
          w,
          h,
          Math.min(14, Math.min(w, h) * 0.2)
        );
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    }
      case "arrow":
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = "source-over";
        ctx.stroke();
      {
        const headlen = 10 + evt.size;
        const angle = Math.atan2(evt.toY - evt.fromY, evt.toX - evt.fromX);
        ctx.beginPath();
        ctx.moveTo(evt.toX, evt.toY);
        ctx.lineTo(
          evt.toX - headlen * Math.cos(angle - Math.PI / 6),
          evt.toY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(evt.toX, evt.toY);
        ctx.lineTo(
          evt.toX - headlen * Math.cos(angle + Math.PI / 6),
          evt.toY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      break;
    case "erase": {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const ew = evt.eraserSize !== undefined ? evt.eraserSize : evt.size || 10;
      ctx.lineWidth = ew;
      const pin =
        evt.dot === true ||
        (Math.abs(evt.fromX - evt.toX) < 0.02 &&
          Math.abs(evt.fromY - evt.toY) < 0.02);
      if (pin) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(evt.fromX, evt.fromY, ew / 2, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = evt.color;
      ctx.lineWidth = evt.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pin =
        evt.dot === true ||
        (Math.abs(evt.fromX - evt.toX) < 0.02 &&
          Math.abs(evt.fromY - evt.toY) < 0.02);
      if (pin) {
        ctx.fillStyle = evt.color;
        const r = Math.max(0.5, evt.size / 2);
        ctx.beginPath();
        ctx.arc(evt.fromX, evt.fromY, r, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/** Readable label text on top of a hex stroke color */
function pickContrastingText(hex) {
  if (!hex || typeof hex !== "string") return "#ffffff";
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "#0f172a" : "#ffffff";
}

function nameInitial(name) {
  const t = String(name || "").trim();
  if (!t) return "?";
  return t.charAt(0).toLocaleUpperCase();
}

function avatarHueFromName(name) {
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Collaborative canvas: drawing logic is unchanged; transport is room-scoped
 * via Socket.IO auth (room JWT) and server-side `socket.to(roomId)` fan-out.
 */
export default function Whiteboard({
  roomId,
  roomToken,
  role = "editor",
  displayName = "User",
  canDraw = true,
}) {
  const canvasRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState("pen");
  const [currentColor, setCurrentColor] = useState("#3b82f6");
  const [currentSize, setCurrentSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  /** Paint-style solid fill for closed shapes (rect, circle, …) */
  const [shapeFilled, setShapeFilled] = useState(true);
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [shapeStart, setShapeStart] = useState(null);
  const [history, setHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [cursors, setCursors] = useState({});
  const [socketError, setSocketError] = useState("");
  /** Tool sidebar: open on first load; collapses while drawing */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Right “People” rail (does not cover tools sidebar) */
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [mySocketId, setMySocketId] = useState(null);
  const rafPreview = useRef(null);
  const lastCursorEmit = useRef(0);
  const historyRef = useRef([]);
  /** True after pointer moved while drawing pen/eraser (skip click-only dot if moved). */
  const freestyleMovedRef = useRef(false);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const palette = [
    "#000000",
    "#ef4444",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#f472b6",
    "#facc15",
    "#22d3ee",
    "#94a3b8",
  ];

  const shapeOptions = [
    { label: "Pen", value: "pen", group: "draw" },
    { label: "Eraser", value: "eraser", group: "draw" },
    { label: "Line", value: "line", group: "shapes" },
    { label: "Rectangle", value: "rectangle", group: "shapes" },
    { label: "Circle", value: "circle", group: "shapes" },
    { label: "Ellipse", value: "ellipse", group: "shapes" },
    { label: "Arrow", value: "arrow", group: "shapes" },
    { label: "Triangle", value: "triangle", group: "shapes" },
    { label: "Diamond", value: "diamond", group: "shapes" },
    { label: "Round rect", value: "roundRect", group: "shapes" },
    { label: "Star", value: "star", group: "shapes" },
  ];

  const redrawCanvas = useCallback((drawings) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach((evt) => drawOnCanvas(ctx, evt));
  }, []);

  useEffect(() => {
    if (!roomToken || !roomId) return undefined;
    setSocketError("");
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: roomToken },
      reconnectionAttempts: 12,
      reconnectionDelayMax: 8000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setSocketError("");
      setMySocketId(newSocket.id);
    });
    newSocket.on("disconnect", () => setIsConnected(false));
    newSocket.on("connect_error", (err) => {
      setIsConnected(false);
      setSocketError(err?.message || "Could not connect");
    });

    newSocket.on("user_count_update", setUserCount);
    newSocket.on("drawing_history", (h) => {
      setHistory(h);
      redrawCanvas(h);
    });
    newSocket.on("full_resync", ({ strokes }) => {
      setHistory(strokes || []);
      redrawCanvas(strokes || []);
    });

    newSocket.on("remote_draw", (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      drawOnCanvas(ctx, data);
      setHistory((prev) => [...prev, data]);
      if (data.socketId) {
        setCursors((prev) => {
          const cur = prev[data.socketId];
          if (!cur) return prev;
          return {
            ...prev,
            [data.socketId]: {
              ...cur,
              color: data.color || cur.color,
            },
          };
        });
      }
    });

    newSocket.on("remote_erase", (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      drawOnCanvas(ctx, data);
      setHistory((prev) => [...prev, data]);
    });

    newSocket.on("board_cleared", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      setHistory([]);
    });

    newSocket.on("participants_update", ({ participants: p }) => {
      setParticipants(Array.isArray(p) ? p : []);
    });

    newSocket.on("remote_cursor", (payload) => {
      const strokeColor = payload.color || "#6366f1";
      setCursors((prev) => ({
        ...prev,
        [payload.socketId]: {
          nx: payload.nx,
          ny: payload.ny,
          name: payload.displayName || "Peer",
          color: strokeColor,
        },
      }));
    });

    newSocket.on("user_disconnected", (id) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    return () => newSocket.close();
  }, [roomId, roomToken, redrawCanvas]);

  useEffect(() => {
    if (!peopleOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setPeopleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peopleOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (currentTool === "eraser") {
      ctx.lineWidth = eraserSize;
    } else {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
  }, [currentColor, currentSize, currentTool, eraserSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const area = canvasAreaRef.current;
    if (!canvas || !area) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const r = area.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      redrawCanvas(historyRef.current);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(area);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [redrawCanvas]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x:
        ((e.clientX - rect.left) * (canvas.width / rect.width)) /
        window.devicePixelRatio,
      y:
        ((e.clientY - rect.top) * (canvas.height / rect.height)) /
        window.devicePixelRatio,
    };
  };

  const getTouchPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] ?? e.changedTouches?.[0];
    if (!touch) return { x: 0, y: 0 };
    return {
      x:
        ((touch.clientX - rect.left) * (canvas.width / rect.width)) /
        window.devicePixelRatio,
      y:
        ((touch.clientY - rect.top) * (canvas.height / rect.height)) /
        window.devicePixelRatio,
    };
  };

  const cursorStrokeColor =
    currentTool === "eraser" ? "#94a3b8" : currentColor;

  const emitCursorFromEvent = useCallback(
    (e) => {
      if (!socket?.connected) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx =
        e.clientX ??
        (e.touches && e.touches[0] ? e.touches[0].clientX : undefined);
      const cy =
        e.clientY ??
        (e.touches && e.touches[0] ? e.touches[0].clientY : undefined);
      if (cx === undefined || cy === undefined) return;
      const nx = (cx - rect.left) / rect.width;
      const ny = (cy - rect.top) / rect.height;
      const now = performance.now();
      if (now - lastCursorEmit.current < 40) return;
      lastCursorEmit.current = now;
      socket.emit("cursor_move", {
        nx,
        ny,
        color: cursorStrokeColor,
      });
    },
    [socket, cursorStrokeColor]
  );

  const startDrawing = (e) => {
    if (!canDraw) return;
    e.preventDefault();
    if (canDraw) setSidebarOpen(false);
    const pos = e.type.includes("touch") ? getTouchPos(e) : getMousePos(e);
    setLastPos(pos);
    setIsDrawing(true);

    if (SHAPE_TOOL_TYPES.includes(currentTool)) {
      setShapeStart(pos);
    } else {
      freestyleMovedRef.current = false;
      const ctx = canvasRef.current.getContext("2d");
      if (currentTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = eraserSize;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e) => {
    emitCursorFromEvent(e);
    const pos = e.type.includes("touch") ? getTouchPos(e) : getMousePos(e);

    if (!isDrawing || !canvasRef.current || !canDraw) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");

    if (SHAPE_TOOL_TYPES.includes(currentTool)) {
      if (rafPreview.current) cancelAnimationFrame(rafPreview.current);
      rafPreview.current = requestAnimationFrame(() => {
        redrawCanvas(history);
        drawOnCanvas(ctx, {
          type: currentTool,
          fromX: shapeStart?.x,
          fromY: shapeStart?.y,
          toX: pos.x,
          toY: pos.y,
          color: currentColor,
          size: currentSize,
          eraserSize,
          filled:
            FILL_CAPABLE_SHAPES.has(currentTool) && shapeFilled,
        });
      });
      return;
    }

    if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) > 0.12) {
      freestyleMovedRef.current = true;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    const eventType = currentTool === "eraser" ? "erase" : "draw";
    const data = {
      type: eventType,
      fromX: lastPos.x,
      fromY: lastPos.y,
      toX: pos.x,
      toY: pos.y,
      color: currentColor,
      size: currentSize,
      eraserSize,
    };
    setHistory((prev) => [...prev, data]);
    if (socket && socket.connected) socket.emit(eventType, data);
    setLastPos(pos);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const ctx = canvasRef.current.getContext("2d");
    const pos = e.type.includes("touch") ? getTouchPos(e) : getMousePos(e);

    if (shapeStart && SHAPE_TOOL_TYPES.includes(currentTool)) {
      const shapeData = {
        type: currentTool,
        fromX: shapeStart.x,
        fromY: shapeStart.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        eraserSize,
        ...(FILL_CAPABLE_SHAPES.has(currentTool)
          ? { filled: shapeFilled }
          : {}),
      };
      drawOnCanvas(ctx, shapeData);
      setHistory((prev) => [...prev, shapeData]);
      if (socket && socket.connected) socket.emit("draw", shapeData);
      setShapeStart(null);
    } else if (
      !shapeStart &&
      (currentTool === "pen" || currentTool === "eraser")
    ) {
      if (!freestyleMovedRef.current) {
        const x = lastPos.x;
        const y = lastPos.y;
        if (currentTool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
          ctx.fill();
          const dotErase = {
            type: "erase",
            fromX: x,
            fromY: y,
            toX: x,
            toY: y,
            color: currentColor,
            size: currentSize,
            eraserSize,
            dot: true,
          };
          setHistory((prev) => [...prev, dotErase]);
          if (socket && socket.connected) socket.emit("erase", dotErase);
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = currentColor;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.5, currentSize / 2), 0, Math.PI * 2);
          ctx.fill();
          const dotDraw = {
            type: "draw",
            fromX: x,
            fromY: y,
            toX: x,
            toY: y,
            color: currentColor,
            size: currentSize,
            eraserSize,
            dot: true,
          };
          setHistory((prev) => [...prev, dotDraw]);
          if (socket && socket.connected) socket.emit("draw", dotDraw);
        }
      }
    }
    ctx.beginPath();
  };

  const clearBoard = () => {
    if (role !== "host") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    if (socket && socket.connected) socket.emit("clear_board");
  };

  const undoLastRef = useRef(() => {});
  undoLastRef.current = () => {
    if (!canDraw || !socket?.connected) return;
    socket.emit("undo_last");
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `canvasquill-${roomId?.slice(0, 8) || "board"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      /* ignore */
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
        return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        undoLastRef.current();
        return;
      }
      if (k === "p") setCurrentTool("pen");
      if (k === "e") setCurrentTool("eraser");
      if (k === "l") setCurrentTool("line");
      if (k === "r") setCurrentTool("rectangle");
      if (k === "c") setCurrentTool("circle");
      if (k === "u") setCurrentTool("ellipse");
      if (k === "a") setCurrentTool("arrow");
      if (k === "t") setCurrentTool("triangle");
      if (k === "m") setCurrentTool("diamond");
      if (k === "b") setCurrentTool("roundRect");
      if (k === "8") setCurrentTool("star");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDraw]);

  const drawTools = shapeOptions.filter((o) => o.group === "draw");
  const shapeTools = shapeOptions.filter((o) => o.group === "shapes");

  const onlineShort = `${userCount} online`;

  const sortedPeople = useMemo(() => {
    const list = Array.isArray(participants) ? [...participants] : [];
    list.sort((a, b) => {
      const ah = a.role === "host" ? 0 : 1;
      const bh = b.role === "host" ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return String(a.displayName || "").localeCompare(
        String(b.displayName || ""),
        undefined,
        { sensitivity: "base" }
      );
    });
    return list;
  }, [participants]);

  const peopleRows = useMemo(() => {
    if (sortedPeople.length > 0) return sortedPeople;
    return [{ socketId: mySocketId || "__local__", displayName, role }];
  }, [sortedPeople, mySocketId, displayName, role]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_input[type=color]:not(:disabled)]:cursor-pointer [&_input[type=range]:not(:disabled)]:cursor-pointer">
      {/* Top navbar: Home (text only), room id, live status, theme, you */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="cursor-pointer text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Home
          </Link>
          <span
            className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono max-w-[200px] sm:max-w-md"
            title="Room"
          >
            {roomId}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[12rem] text-xs text-slate-600 dark:text-slate-300">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              isConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
            title={isConnected ? "Live" : "Off"}
          />
          <span className="truncate cursor-default" title="Users">
            {onlineShort}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto sm:ml-auto">
          <button
            type="button"
            onClick={copyRoomId}
            title="Copy ID"
            className="cursor-pointer text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Copy ID
          </button>
          <button
            type="button"
            onClick={copyInvite}
            title="Copy link"
            className="cursor-pointer text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={exportPng}
            title="PNG"
            className="cursor-pointer text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={() => undoLastRef.current()}
            disabled={!canDraw}
            title="Undo"
            className="cursor-pointer text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo
          </button>
          {role === "host" && (
            <button
              type="button"
              onClick={clearBoard}
              title="Clear"
              className="cursor-pointer text-[11px] font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white px-2 py-1.5"
            >
              Clear
            </button>
          )}
          <ThemeToggleButton />
          <button
            type="button"
            onClick={() => setPeopleOpen((o) => !o)}
            title="People"
            aria-label="People in room"
            aria-expanded={peopleOpen}
            className={`flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-100 py-1 pl-1 pr-2.5 shadow-sm transition hover:bg-slate-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${
              peopleOpen
                ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900"
                : ""
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-sm">
              {nameInitial(displayName)}
            </span>
            <span className="min-w-[1ch] text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {userCount}
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {!sidebarOpen && (
          <div className="shrink-0 w-12 flex flex-col items-center pt-3 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-20">
            <button
              type="button"
              title="Tools"
              aria-label="Tools"
              aria-expanded={false}
              aria-controls="whiteboard-tools-sidebar"
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <IconSidebarClosed />
            </button>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 px-1 text-center leading-tight">
              Tools
            </span>
          </div>
        )}

        <aside
          id="whiteboard-tools-sidebar"
          className={`shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden transition-[width] duration-200 ease-out ${
            sidebarOpen
              ? "w-[min(15rem,calc(100vw-2rem))]"
              : "w-0 border-0 overflow-hidden"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0 min-w-[13.5rem]">
            <span className="text-[11px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">
              Tools
            </span>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              aria-expanded={true}
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 bg-zinc-200/70 dark:bg-zinc-800/80 hover:bg-zinc-300/80 dark:hover:bg-zinc-700 border border-zinc-300/60 dark:border-zinc-700"
            >
              <IconSidebarOpen />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-3 min-w-[13.5rem] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
            {!canDraw && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200/90">
                View-only — drawing is disabled.
              </p>
            )}

            <div className="rounded-xl bg-white/80 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 p-2">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">
                Draw
              </p>
              <div className="flex gap-1">
                {drawTools.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={TOOL_HINTS[opt.value] || opt.label}
                    aria-label={TOOL_HINTS[opt.value] || opt.label}
                    onClick={() => setCurrentTool(opt.value)}
                    className={`flex-1 min-w-0 h-9 rounded-lg flex items-center justify-center border transition ${
                      currentTool === opt.value
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <ToolRailIcon
                      tool={opt.value}
                      className="w-[14px] h-[14px] shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 p-2">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">
                Shapes
              </p>
              <div className="grid grid-cols-4 gap-1">
                {shapeTools.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={TOOL_HINTS[opt.value] || opt.label}
                    aria-label={TOOL_HINTS[opt.value] || opt.label}
                    onClick={() => setCurrentTool(opt.value)}
                    className={`h-9 rounded-lg flex items-center justify-center border transition ${
                      currentTool === opt.value
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <ToolRailIcon
                      tool={opt.value}
                      className="w-[15px] h-[15px] shrink-0"
                    />
                  </button>
                ))}
              </div>
              <div
                className={`mt-2 flex rounded-lg border p-0.5 gap-0.5 ${
                  FILL_CAPABLE_SHAPES.has(currentTool)
                    ? "border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/40"
                    : "border-zinc-100 dark:border-zinc-800/50 opacity-50"
                }`}
              >
                <button
                  type="button"
                  disabled={!canDraw || !FILL_CAPABLE_SHAPES.has(currentTool)}
                  onClick={() => setShapeFilled(true)}
                  title="Fill"
                  aria-label="Fill"
                  className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1 text-[10px] font-medium transition ${
                    shapeFilled && FILL_CAPABLE_SHAPES.has(currentTool)
                      ? "bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <IconFill className="w-3.5 h-3.5 shrink-0" />
                  Fill
                </button>
                <button
                  type="button"
                  disabled={!canDraw || !FILL_CAPABLE_SHAPES.has(currentTool)}
                  onClick={() => setShapeFilled(false)}
                  title="Outline"
                  aria-label="Outline"
                  className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1 text-[10px] font-medium transition ${
                    !shapeFilled && FILL_CAPABLE_SHAPES.has(currentTool)
                      ? "bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <IconOutline className="w-3.5 h-3.5 shrink-0" />
                  Outline
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 p-2">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">
                Color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {palette.map((clr) => (
                  <button
                    key={clr}
                    type="button"
                    disabled={!canDraw}
                    title={SWATCH_HINT[clr] || "Color"}
                    aria-label={SWATCH_HINT[clr] || "Color"}
                    className={`w-7 h-7 rounded-full border-2 shrink-0 ${
                      currentColor === clr
                        ? "border-indigo-600 ring-2 ring-indigo-400/80 scale-105"
                        : "border-zinc-200 dark:border-zinc-600"
                    }`}
                    style={{ backgroundColor: clr }}
                    onClick={() => setCurrentColor(clr)}
                  />
                ))}
                <input
                  type="color"
                  value={currentColor}
                  disabled={!canDraw}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  title="Color"
                  aria-label="Color"
                  className="w-7 h-7 border border-zinc-200 dark:border-zinc-600 rounded-lg cursor-pointer bg-transparent"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 p-2">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Size ({currentTool === "eraser" ? eraserSize : currentSize}px)
              </p>
              <input
                type="range"
                min="1"
                max="40"
                disabled={!canDraw}
                title="Size"
                aria-label="Size"
                value={
                  currentTool === "pen"
                    ? currentSize
                    : currentTool === "eraser"
                    ? eraserSize
                    : currentSize
                }
                onChange={(e) =>
                  currentTool === "pen"
                    ? setCurrentSize(+e.target.value)
                    : currentTool === "eraser"
                    ? setEraserSize(+e.target.value)
                    : setCurrentSize(+e.target.value)
                }
                className="w-full accent-indigo-600 dark:accent-indigo-500"
                suppressHydrationWarning
              />
            </div>
          </div>
        </aside>

        {/* Canvas + People (right panel sits beside canvas, not over tools) */}
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:p-3">
            <div
              ref={canvasAreaRef}
              className="relative flex-1 min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 block h-full w-full ${
                  canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-90"
                }`}
                width={1200}
                height={600}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  touchAction: "none",
                  background: "transparent",
                }}
              />
              <div className="pointer-events-none absolute inset-0">
                {Object.entries(cursors).map(([id, c]) => {
                  const bg = c.color || "#6366f1";
                  const fg = pickContrastingText(bg);
                  return (
                    <div
                      key={id}
                      className="absolute flex flex-col items-start"
                      style={{
                        left: `${(c.nx ?? 0) * 100}%`,
                        top: `${(c.ny ?? 0) * 100}%`,
                        transform: "translate(-4px, -4px)",
                      }}
                    >
                      <span
                        className="max-w-[8rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium shadow"
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {c.name}
                      </span>
                      <span
                        className="mt-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80"
                        style={{ backgroundColor: bg }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {peopleOpen && (
            <aside
              className="flex w-[min(18rem,calc(100vw-2rem))] shrink-0 flex-col border-l border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-zinc-950"
              aria-label="People in room"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  People
                </h2>
                <button
                  type="button"
                  title="Close"
                  aria-label="Close"
                  onClick={() => setPeopleOpen(false)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
              <p className="shrink-0 px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                In the room
              </p>
              <ul className="min-h-0 flex-1 list-none space-y-1 overflow-y-auto p-2 [scrollbar-width:thin]">
                {peopleRows.map((p) => {
                  const isYou =
                    mySocketId && p.socketId === mySocketId
                      ? true
                      : p.socketId === "__local__";
                  const hue = avatarHueFromName(p.displayName);
                  return (
                    <li
                      key={p.socketId}
                      className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 hover:bg-slate-50 dark:hover:bg-zinc-900/80"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
                        style={{
                          backgroundColor: `hsl(${hue} 52% 40%)`,
                        }}
                      >
                        {nameInitial(p.displayName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {p.displayName}
                          {isYou ? (
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {" "}
                              (You)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs capitalize text-slate-500 dark:text-slate-400">
                          {p.role}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      </div>

      {(!isConnected || socketError) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg z-50 text-sm max-w-[90vw] text-center">
          {socketError || "Reconnecting…"}
        </div>
      )}
    </div>
  );
}
