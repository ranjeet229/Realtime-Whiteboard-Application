'use client';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  useEffect(() => {
    const newSocket = io('https://rtwhiteboardrk.onrender.com', {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      newSocket.emit('user_join', {
        username: `User_${Math.random().toString(36).substr(2, 5)}`
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('user_count_update', (count) => {
      setUserCount(count);
    });

    newSocket.on('drawing_history', (history) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      history.forEach(event => {
        drawOnCanvas(ctx, event);
      });
    });

    newSocket.on('remote_draw', (drawData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      drawOnCanvas(ctx, drawData);
    });

    newSocket.on('remote_erase', (eraseData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      drawOnCanvas(ctx, eraseData);
    });

    newSocket.on('board_cleared', () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = (window.innerHeight - 200) * window.devicePixelRatio;
      canvas.style.height = (window.innerHeight - 200) + 'px';
    } else {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = 600 * window.devicePixelRatio;
      canvas.style.height = '600px';
    }
    
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;

    const handleResize = () => {
      const newRect = canvas.getBoundingClientRect();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (window.innerWidth < 768) {
        canvas.width = newRect.width * window.devicePixelRatio;
        canvas.height = (window.innerHeight - 200) * window.devicePixelRatio;
        canvas.style.height = (window.innerHeight - 200) + 'px';
      } else {
        canvas.width = newRect.width * window.devicePixelRatio;
        canvas.height = 600 * window.devicePixelRatio;
        canvas.style.height = '600px';
      }
      
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.putImageData(imageData, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const drawOnCanvas = (ctx, drawData) => {
    ctx.beginPath();
    ctx.moveTo(drawData.fromX, drawData.fromY);
    
    if (drawData.type === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawData.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.size;
    }
    
    ctx.lineTo(drawData.toX, drawData.toY);
    ctx.stroke();
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width) / window.devicePixelRatio,
      y: (e.clientY - rect.top) * (canvas.height / rect.height) / window.devicePixelRatio
    };
  };

  const getTouchPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width) / window.devicePixelRatio,
      y: (touch.clientY - rect.top) * (canvas.height / rect.height) / window.devicePixelRatio
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    
    const pos = e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);
    setLastPos(pos);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = currentSize * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    if (socket && socket.connected) {
      const eventType = currentTool === 'eraser' ? 'erase' : 'draw';
      socket.emit(eventType, {
        type: eventType,
        fromX: lastPos.x,
        fromY: lastPos.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize
      });
    }
    
    setLastPos(pos);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (socket && socket.connected) {
      socket.emit('clear_board');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header with Toolbar - All in One */}
      <div className="bg-white shadow-md border-b border-gray-200">
        {/* Title and Status Bar */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">
              Collaborative Whiteboard
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
                <span className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></span>
                <span className="text-sm font-medium text-gray-700">
                  {userCount} online
                </span>
              </div>
              <button 
                onClick={clearBoard}
                className="px-4 py-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all text-sm font-medium shadow-sm hover:shadow"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Unified Toolbar - Desktop */}
        <div className="hidden md:block px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            {/* Left Section: Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTool('pen')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTool === 'pen' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ✏️ Pen
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTool === 'eraser' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🧽 Eraser
              </button>
            </div>

            {/* Center Section: Colors */}
            <div className="flex items-center gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-9 h-9 rounded-lg transition-all hover:scale-110 ${
                    currentColor === color 
                      ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' 
                      : 'ring-1 ring-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            {/* Right Section: Size Slider */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Size:
              </span>
              <input
                type="range"
                min="1"
                max="50"
                value={currentSize}
                onChange={(e) => setCurrentSize(parseInt(e.target.value))}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-sm font-semibold text-gray-700 w-10 text-center">
                {currentSize}px
              </span>
            </div>
          </div>
        </div>

        {/* Unified Toolbar - Mobile */}
        <div className="md:hidden px-3 py-3">
          <div className="flex flex-col gap-3">
            {/* Tools Row */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentTool('pen')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTool === 'pen' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                ✏️ Pen
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTool === 'eraser' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                🧽 Eraser
              </button>
            </div>
            
            {/* Colors and Size Row */}
            <div className="flex items-center gap-3">
              <div className="flex gap-2 flex-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setCurrentColor(color)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      currentColor === color 
                        ? 'ring-2 ring-gray-800 scale-110' 
                        : 'ring-1 ring-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={currentSize}
                  onChange={(e) => setCurrentSize(parseInt(e.target.value))}
                  className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs font-semibold text-gray-700 w-8">
                  {currentSize}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-7xl mx-auto h-full">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden h-full">
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
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-3 text-center bg-white border-t border-gray-200">
        <p className="text-sm text-gray-500">Created by Ranjeet Kumar</p>
      </div>

      {/* Connection Status Alert */}
      {!isConnected && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            <span className="text-sm font-medium">Reconnecting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
