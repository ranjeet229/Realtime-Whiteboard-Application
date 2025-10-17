'use client';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(4);
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  // ✅ Initialize Socket
  useEffect(() => {
    const newSocket = io('https://rtwhiteboardrk.onrender.com', {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user_join', {
        username: `User_${Math.random().toString(36).substr(2, 5)}`,
      });
    });

    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('user_count_update', (count) => setUserCount(count));

    newSocket.on('drawing_history', (history) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      history.forEach((event) => drawOnCanvas(ctx, event));
    });

    newSocket.on('remote_draw', (data) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawOnCanvas(ctx, data);
    });

    newSocket.on('remote_erase', (data) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawOnCanvas(ctx, data);
    });

    newSocket.on('board_cleared', () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    return () => newSocket.close();
  }, []);

  // ✅ Brush settings
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

  // ✅ Canvas Setup + Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      const width = rect.width * window.devicePixelRatio;
      const height = (isMobile ? window.innerHeight - 200 : 700) * window.devicePixelRatio;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = width;
      canvas.height = height;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.putImageData(imageData, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // ✅ Draw Logic
  const drawOnCanvas = (ctx, data) => {
    ctx.beginPath();
    ctx.moveTo(data.fromX, data.fromY);
    ctx.lineTo(data.toX, data.toY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = data.type === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.stroke();
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const input = e.touches ? e.touches[0] : e;
    return {
      x: (input.clientX - rect.left),
      y: (input.clientY - rect.top),
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setLastPos(getPos(e));
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    drawOnCanvas(ctx, {
      type: currentTool === 'eraser' ? 'erase' : 'draw',
      fromX: lastPos.x,
      fromY: lastPos.y,
      toX: pos.x,
      toY: pos.y,
      color: currentColor,
      size: currentSize,
    });

    if (socket && socket.connected) {
      socket.emit(currentTool === 'eraser' ? 'erase' : 'draw', {
        fromX: lastPos.x,
        fromY: lastPos.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
      });
    }
    setLastPos(pos);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearBoard = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket?.emit('clear_board');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-gray-800">
      {/* ✅ HEADER */}
      <header className="bg-white border-b shadow-sm fixed top-0 w-full z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 md:p-4">
          <h1 className="font-bold text-lg md:text-xl tracking-tight text-gray-800">
            🧠 Real-Time Whiteboard
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {userCount} online
              </span>
            </div>
            <button
              onClick={clearBoard}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg shadow transition"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {/* ✅ TOOLBAR (Desktop Floating Panel) */}
      <aside className="hidden md:flex fixed left-6 top-28 flex-col gap-5 bg-white p-4 rounded-2xl shadow-xl border z-30">
        <div className="flex flex-col items-center gap-3">
          {/* Tools */}
          <button
            onClick={() => setCurrentTool('pen')}
            className={`p-2 rounded-full ${
              currentTool === 'pen'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            ✏️
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded-full ${
              currentTool === 'eraser'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            🧽
          </button>
        </div>

        {/* Colors */}
        <div className="flex flex-col items-center gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                currentColor === color
                  ? 'border-gray-800 scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex flex-col items-center">
          <input
            type="range"
            min="1"
            max="50"
            value={currentSize}
            onChange={(e) => setCurrentSize(parseInt(e.target.value))}
            className="rotate-[-90deg] w-24 accent-blue-500"
          />
          <span className="text-xs text-gray-600 mt-2">{currentSize}px</span>
        </div>
      </aside>

      {/* ✅ CANVAS */}
      <main className="flex-grow flex justify-center items-center pt-24 md:pt-28 pb-28 md:pb-10">
        <div className="bg-white rounded-xl shadow-xl border overflow-hidden w-full max-w-6xl">
          <canvas
            ref={canvasRef}
            className="block w-full cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
        </div>
      </main>

      {/* ✅ MOBILE TOOLBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex flex-col gap-3 z-50">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentTool('pen')}
            className={`flex-1 py-2 rounded-lg font-medium ${
              currentTool === 'pen'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ✏️ Pen
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`flex-1 py-2 rounded-lg font-medium ${
              currentTool === 'eraser'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🧽 Eraser
          </button>
        </div>
        <div className="flex justify-center gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                currentColor === color
                  ? 'border-gray-800 scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Size:</span>
          <input
            type="range"
            min="1"
            max="50"
            value={currentSize}
            onChange={(e) => setCurrentSize(parseInt(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <span className="text-sm text-gray-600 w-10">{currentSize}px</span>
        </div>
      </div>

      <footer className="text-center text-gray-500 text-sm py-4">
        created by <span className="font-semibold">Ranjeet Kumar</span>
      </footer>

      {!isConnected && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-5 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-sm">Reconnecting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
