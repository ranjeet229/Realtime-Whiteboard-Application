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


  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const [cursorPos, setCursorPos] = useState({ x: null, y: null });


  useEffect(() => {
    // Initialize karo socket connection ko
    const newSocket = io('https://rtwhiteboardrk.onrender.com', {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);


    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      
      // Join as user
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
      // Redraw all previous drawing events
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


  // Update karo  brush color ko and size without resizing or clearing the canvas
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
    
    // Set canvas background size to match display size
    const rect = canvas.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    


    //mobile device ke liye 
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
    
    // Set drawing properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;


    // Handle resize
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
    
    // Send drawing data to server 
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
    <div className="min-h-screen bg-gray-50">
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
              >
                ✏️ Pen
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTool === 'eraser' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🧽 Eraser
              </button>
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
          </div>


          {/* Size */}
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">Size:</span>
            <input
              type="range"
              min="1"
              max="50"
              value={currentSize}
              onChange={(e) => setCurrentSize(parseInt(e.target.value))}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 w-8">{currentSize}px</span>
          </div>
        </div>
      </div>


      {/* Mobile Toolbar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50 shadow-lg">
        {/* Tool Selection Row */}
        <div className="flex space-x-2 mb-3">
          <button
            onClick={() => setCurrentTool('pen')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTool === 'pen' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ✏️ Pen
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTool === 'eraser' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            🧽 Eraser
          </button>
        </div>
        
        {/* Color Palette Row */}
        <div className="flex justify-center space-x-3 mb-3">
          {colors.map(color => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                currentColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        
        {/* Size Control Row */}
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Size:</span>
          <input
            type="range"
            min="1"
            max="50"
            value={currentSize}
            onChange={(e) => setCurrentSize(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-8">{currentSize}px</span>
        </div>
      </div>


      {/* Canvas */}
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
      <div className='text-color py-4 text-gray-500 text-sm'>
          created by Ranjeet Kumar
      </div>


      {/* Connection Status */}
      {!isConnected && (
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
