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
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [roomType, setRoomType] = useState('public'); 
  const [passKey, setPassKey] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [drawingShape, setDrawingShape] = useState('free'); 
  const [eraserSize, setEraserSize] = useState(20);
  const [pencilType, setPencilType] = useState('solid');
  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const [startShapePos, setStartShapePos] = useState(null);
  const [tempCanvasImage, setTempCanvasImage] = useState(null);

  // Socket Initialization and Handlers
  useEffect(() => {
    if (!isJoined) return;
    const newSocket = io('https://rtwhiteboardrk.onrender.com', {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user_join', {
        username: `User_${Math.random().toString(36).substr(2, 5)}`,
        roomType,
        passKey: roomType === 'private' ? passKey : undefined
      });
    });
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('connect_error', () => setIsConnected(false));
    newSocket.on('user_count_update', setUserCount);
    newSocket.on('drawing_history', (history) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      history.forEach(event => drawOnCanvas(ctx, event));
    });
    newSocket.on('remote_draw', data => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawOnCanvas(canvas.getContext('2d'), data);
    });
    newSocket.on('remote_erase', data => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawOnCanvas(canvas.getContext('2d'), data);
    });
    newSocket.on('board_cleared', () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    return () => { newSocket.close(); };
    // eslint-disable-next-line
  }, [isJoined]);

  // Brush color/size update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

  // Initial and resize setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = (window.innerHeight - 250) * window.devicePixelRatio;
      canvas.style.height = (window.innerHeight - 250) + 'px';
    } else {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = 700 * window.devicePixelRatio;
      canvas.style.height = '700px';
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
        canvas.height = (window.innerHeight - 250) * window.devicePixelRatio;
        canvas.style.height = (window.innerHeight - 250) + 'px';
      } else {
        canvas.width = newRect.width * window.devicePixelRatio;
        canvas.height = 700 * window.devicePixelRatio;
        canvas.style.height = '700px';
      }
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.putImageData(imageData, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw functions
  function drawOnCanvas(ctx, drawData) {
    ctx.save();
    ctx.beginPath();
    if (drawData.type === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawData.eraserSize || 20;
      ctx.moveTo(drawData.fromX, drawData.fromY);
      ctx.lineTo(drawData.toX, drawData.toY);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.size;
      ctx.setLineDash(drawData.pencilType === 'dashed' ? [10, 10] : []);
      switch (drawData.shape) {
        case 'rectangle':
          ctx.strokeRect(
            drawData.fromX,
            drawData.fromY,
            drawData.toX - drawData.fromX,
            drawData.toY - drawData.fromY
          );
          break;
        case 'circle': {
          const radius = Math.hypot(drawData.toX - drawData.fromX, drawData.toY - drawData.fromY);
          ctx.arc(drawData.fromX, drawData.fromY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case 'line':
          ctx.moveTo(drawData.fromX, drawData.fromY);
          ctx.lineTo(drawData.toX, drawData.toY);
          ctx.stroke();
          break;
        default: // free
          ctx.moveTo(drawData.fromX, drawData.fromY);
          ctx.lineTo(drawData.toX, drawData.toY);
          ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // Mouse/Touch Helpers
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

  // Drawing Handlers
  const startDrawing = (e) => {
    if (!isJoined) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);
    setLastPos(pos);

    if (drawingShape !== 'free') {
      setStartShapePos(pos);
      const canvas = canvasRef.current;
      setTempCanvasImage(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
    } else {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = eraserSize;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.setLineDash(pencilType === 'dashed' ? [10, 10] : []);
      }
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e) => {
    if (!isDrawing || !isJoined) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);

    if (drawingShape !== 'free' && startShapePos && tempCanvasImage) {
      ctx.putImageData(tempCanvasImage, 0, 0);
      const drawData = {
        type: currentTool === 'eraser' ? 'erase' : 'draw',
        fromX: startShapePos.x,
        fromY: startShapePos.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        shape: drawingShape,
        pencilType,
        eraserSize: eraserSize
      };
      drawOnCanvas(ctx, drawData);
    } else {
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
          size: currentSize,
          shape: drawingShape,
          pencilType,
          eraserSize: eraserSize
        });
      }
      setLastPos(pos);
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing || !isJoined) return;
    e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (drawingShape !== 'free' && startShapePos && tempCanvasImage) {
      const pos = e.type && e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);
      ctx.putImageData(tempCanvasImage, 0, 0);
      const drawData = {
        type: currentTool === 'eraser' ? 'erase' : 'draw',
        fromX: startShapePos.x,
        fromY: startShapePos.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        shape: drawingShape,
        pencilType,
        eraserSize: eraserSize
      };
      drawOnCanvas(ctx, drawData);
      if (socket && socket.connected) {
        const eventType = currentTool === 'eraser' ? 'erase' : 'draw';
        socket.emit(eventType, drawData);
      }
      setStartShapePos(null);
      setTempCanvasImage(null);
    }
    ctx.beginPath();
  };

  // Clear Board
  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (socket && socket.connected) {
      socket.emit('clear_board');
    }
  };

  // UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Room Selection */}
      {!isJoined && (
        <div className="bg-white shadow p-4 rounded max-w-md mx-auto my-8">
          <h2 className="text-lg mb-4 font-bold">Join a Whiteboard Room</h2>
          <div className="mb-2">
            <label className="mr-2">Room Type:</label>
            <button
              className={`mr-2 px-3 py-1 rounded ${roomType === 'public' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setRoomType('public')}
            >Public</button>
            <button
              className={`px-3 py-1 rounded ${roomType === 'private' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setRoomType('private')}
            >Private</button>
          </div>
          {roomType === 'private' && (
            <div className="mb-2">
              <input
                type="text"
                placeholder="Enter Passkey"
                value={passKey}
                onChange={e => setPassKey(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
          )}
          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={() => setIsJoined(true)}
          >
            Join Room
          </button>
        </div>
      )}

      {/* Whiteboard UI */}
      {isJoined && (
        <>
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200 p-3 md:p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">Real-Time Collaborative Whiteboard</h1>
              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="flex items-center space-x-1 md:space-x-2">
                  <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  <span className="text-xs md:text-sm text-gray-600">
                    {userCount} user{userCount !== 1 ? 's' : ''} online
                  </span>
                </div>
                <button
                  onClick={clearBoard}
                  className="px-2 py-1 md:px-4 md:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs md:text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Toolbar */}
          <div className="hidden md:block bg-white shadow-sm border-b border-gray-200 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
              {/* Tools */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Tool:</span>
                  <button
                    onClick={() => setCurrentTool('pen')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentTool === 'pen'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >✏️ Pen</button>
                  <button
                    onClick={() => setCurrentTool('eraser')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentTool === 'eraser'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >🧽 Eraser</button>
                </div>
                {/* Shapes */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Shape:</span>
                  {['free', 'rectangle', 'circle', 'line'].map(shape => (
                    <button
                      key={shape}
                      onClick={() => setDrawingShape(shape)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        drawingShape === shape
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </button>
                  ))}
                </div>
                {/* Colors */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Color:</span>
                  <div className="flex space-x-2">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setCurrentColor(color)}
                        className={`w-10 h-10 rounded-full border-3 transition-all ${
                          currentColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                {/* Pencil Type */}
                {currentTool === 'pen' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Pencil:</span>
                    <select
                      value={pencilType}
                      onChange={e => setPencilType(e.target.value)}
                      className="px-2 py-1 border rounded"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                    </select>
                  </div>
                )}
              </div>
              {/* Size */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">
                  {currentTool === 'eraser' ? 'Eraser Size:' : 'Size:'}
                </span>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={currentTool === 'eraser' ? eraserSize : currentSize}
                  onChange={e => {
                    if (currentTool === 'eraser') setEraserSize(parseInt(e.target.value));
                    else setCurrentSize(parseInt(e.target.value));
                  }}
                  className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-600 w-8">
                  {currentTool === 'eraser' ? eraserSize : currentSize}px
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Toolbars & CANVAS below */}
          {/* ... (You can re-use the mobile toolbar logic from your original code, add shapes, etc.) */}

          {/* Canvas Section */}
          <div className="flex-1 p-2 md:p-4 pb-32 md:pb-4">
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="block w-full cursor-crosshair"
                  width={1200}
                  height={700}
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
          <div className="text-color py-4 text-gray-500 text-sm">
            created by Ranjeet Kumar
          </div>
        </>
      )}


      {/* Connection Status */}
      {isJoined && !isConnected && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-sm">Reconnecting to server...</span>
          </div>
        </div>
      )}
    </div>
  );
}
