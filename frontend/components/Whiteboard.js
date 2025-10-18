"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState("pen");
  const [currentColor, setCurrentColor] = useState("#3b82f6");
  const [currentSize, setCurrentSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [shapeStart, setShapeStart] = useState(null);
  const [previewShape, setPreviewShape] = useState(null);
  const [history, setHistory] = useState([]); // ✅ local copy of all drawn shapes

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
    { label: "Pen", value: "pen" },
    { label: "Eraser", value: "eraser" },
    { label: "Line", value: "line" },
    { label: "Rectangle", value: "rectangle" },
    { label: "Circle", value: "circle" },
    { label: "Ellipse", value: "ellipse" },
    { label: "Arrow", value: "arrow" },
  ];

  // --- SOCKET CONNECTION ---
  useEffect(() => {
    const newSocket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      newSocket.emit("user_join", {
        username: `User_${Math.random().toString(36).substr(2, 5)}`,
      });
    });
    newSocket.on("disconnect", () => setIsConnected(false));
    newSocket.on("connect_error", () => setIsConnected(false));
    newSocket.on("user_count_update", setUserCount);

    newSocket.on("drawing_history", (history) => {
      setHistory(history);
      redrawCanvas(history);
    });

    newSocket.on("remote_draw", (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      drawOnCanvas(ctx, data);
      setHistory((prev) => [...prev, data]);
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

    return () => newSocket.close();
  }, []);

  // --- CANVAS INITIALIZATION ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

  // --- RESPONSIVE RESIZE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const temp = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height =
        (window.innerWidth < 768
          ? window.innerHeight - 180
          : 600) * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.putImageData(temp, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // --- COORDINATE HELPERS ---
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
    const touch = e.touches[0];
    return {
      x:
        ((touch.clientX - rect.left) * (canvas.width / rect.width)) /
        window.devicePixelRatio,
      y:
        ((touch.clientY - rect.top) * (canvas.height / rect.height)) /
        window.devicePixelRatio,
    };
  };

  // --- DRAW HANDLERS ---
  const startDrawing = (e) => {
    e.preventDefault();
    const pos = e.type.includes("touch") ? getTouchPos(e) : getMousePos(e);
    setLastPos(pos);
    setIsDrawing(true);

    if (
      ["line", "rectangle", "circle", "ellipse", "arrow"].includes(currentTool)
    ) {
      setShapeStart(pos);
      setPreviewShape(null);
    } else {
      const ctx = canvasRef.current.getContext("2d");
      if (currentTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = eraserSize;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
      }
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const pos = e.type.includes("touch") ? getTouchPos(e) : getMousePos(e);
    const ctx = canvasRef.current.getContext("2d");

    if (
      ["line", "rectangle", "circle", "ellipse", "arrow"].includes(currentTool)
    ) {
      // ✅ draw preview shape on top of existing drawings (without clearing)
      redrawCanvas(history);
      setPreviewShape({
        type: currentTool,
        fromX: shapeStart?.x,
        fromY: shapeStart?.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        eraserSize,
      });
      drawOnCanvas(ctx, {
        type: currentTool,
        fromX: shapeStart?.x,
        fromY: shapeStart?.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        eraserSize,
      });
      return;
    }

    // freehand drawing / erasing
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

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

    if (
      shapeStart &&
      ["line", "rectangle", "circle", "ellipse", "arrow"].includes(currentTool)
    ) {
      const shapeData = {
        type: currentTool,
        fromX: shapeStart.x,
        fromY: shapeStart.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        eraserSize,
      };
      drawOnCanvas(ctx, shapeData);
      setHistory((prev) => [...prev, shapeData]);
      if (socket && socket.connected) socket.emit("draw", shapeData);
      setShapeStart(null);
      setPreviewShape(null);
    }
    ctx.beginPath();
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    if (socket && socket.connected) socket.emit("clear_board");
  };

  // --- DRAW HELPERS ---
  const drawOnCanvas = (ctx, evt) => {
    ctx.save();
    switch (evt.type) {
      case "line":
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.globalCompositeOperation = "source-over";
        ctx.stroke();
        break;
      case "rectangle":
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeRect(
          evt.fromX,
          evt.fromY,
          evt.toX - evt.fromX,
          evt.toY - evt.fromY
        );
        break;
      case "circle":
        ctx.beginPath();
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.globalCompositeOperation = "source-over";
        const r = Math.sqrt(
          (evt.toX - evt.fromX) ** 2 + (evt.toY - evt.fromY) ** 2
        );
        ctx.arc(evt.fromX, evt.fromY, r, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case "ellipse":
        ctx.beginPath();
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.globalCompositeOperation = "source-over";
        ctx.ellipse(
          evt.fromX,
          evt.fromY,
          Math.abs(evt.toX - evt.fromX),
          Math.abs(evt.toY - evt.fromY),
          0,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        break;
      case "arrow":
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.globalCompositeOperation = "source-over";
        ctx.stroke();
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
        break;
      case "erase":
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth =
          evt.eraserSize !== undefined ? evt.eraserSize : evt.size || 10;
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
        break;
      default:
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
    }
    ctx.restore();
  };

  const redrawCanvas = (drawings) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach((evt) => drawOnCanvas(ctx, evt));
  };

  // --- UI ---
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toolbar */}
      <div className="w-full bg-white border-b shadow-sm px-2 py-2 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="tool" className="font-medium text-gray-700 mr-2">
            Tool:
          </label>
          <select
            id="tool"
            value={currentTool}
            onChange={(e) => setCurrentTool(e.target.value)}
            className="font-semibold px-2 py-1 border border-gray-200 rounded-lg text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-400 appearance-none"
          >
            {shapeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Colors */}
          <div className="flex items-center gap-2 overflow-auto">
            {palette.map((clr) => (
              <button
                key={clr}
                className={`w-8 h-8 rounded-full border-2 cursor-pointer focus:ring-2 shadow-sm ${
                  currentColor === clr
                    ? "border-blue-600 ring-2 ring-blue-400"
                    : "border-gray-200"
                }`}
                style={{ backgroundColor: clr }}
                onClick={() => setCurrentColor(clr)}
              />
            ))}
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-8 h-8 border-none rounded-full cursor-pointer"
            />
          </div>

          {/* Size slider */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-gray-700 font-medium">
              {currentTool === "pen"
                ? "Size:"
                : currentTool === "eraser"
                ? "Eraser:"
                : "Shape:"}
            </span>
            <input
              type="range"
              min="1"
              max="40"
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
              className="w-24 accent-blue-500"
            />
            <span className="text-sm font-semibold w-8 text-gray-700">
              {currentTool === "pen"
                ? currentSize
                : currentTool === "eraser"
                ? eraserSize
                : currentSize}
              px
            </span>
          </div>
        </div>

        <div className="flex-grow" />

        <div className="flex items-center gap-4">
          <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-full">
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></span>
            <span className="text-sm font-semibold text-gray-600">
              {userCount} online
            </span>
          </div>
          <button
            onClick={clearBoard}
            className="px-4 py-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 font-medium shadow transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 p-3 flex justify-center items-center">
        <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full h-full relative border overflow-hidden">
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-crosshair"
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
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="py-3 text-center bg-white border-t border-gray-200 mt-auto">
        <span className="text-xs text-gray-400">Created by Ranjeet Kumar</span>
      </div>

      {!isConnected && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            <span className="text-sm font-medium">
              Reconnecting to server...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
