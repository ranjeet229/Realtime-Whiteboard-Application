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
  const [keyOption, setKeyOption] = useState('generate'); // default
  const [isJoined, setIsJoined] = useState(false);

  const [drawingShape, setDrawingShape] = useState('free');
  const [eraserSize, setEraserSize] = useState(20);
  const [pencilType, setPencilType] = useState('solid');
  const [username, setUsername] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [startShapePos, setStartShapePos] = useState(null);
  const [tempCanvasImage, setTempCanvasImage] = useState(null);

  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  // --- Socket IO
  useEffect(() => {
    if (!isJoined) return;
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user_join', {
        username: username || `User_${Math.random().toString(36).substr(2, 5)}`,
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
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });

    // Chat events
    newSocket.on('chat_message', msg => {
      setChatMessages(msgs => [...msgs, msg]);
    });

    return () => { newSocket.close(); };
    // eslint-disable-next-line
  }, [isJoined]);

  useEffect(() => {
    // Align everything with CSS px
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    canvas.width = rect.width;
    canvas.height = isMobile ? window.innerHeight - 250 : 700;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = isMobile ? `${window.innerHeight - 250}px` : '700px';
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;

    window.addEventListener('resize', () => {
      const newRect = canvas.getBoundingClientRect();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = newRect.width;
      canvas.height = isMobile ? window.innerHeight - 250 : 700;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = isMobile ? `${window.innerHeight - 250}px` : '700px';
      ctx.putImageData(imageData, 0, 0);
    });
    // Remove the listener on cleanup
    return () => window.removeEventListener('resize', () => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  }, [currentColor, currentSize]);

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
          ctx.strokeRect(drawData.fromX, drawData.fromY, drawData.toX-drawData.fromX, drawData.toY-drawData.fromY);
          break;
        case 'circle': {
          const radius = Math.hypot(drawData.toX-drawData.fromX, drawData.toY-drawData.fromY);
          ctx.arc(drawData.fromX, drawData.fromY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case 'line':
          ctx.moveTo(drawData.fromX, drawData.fromY);
          ctx.lineTo(drawData.toX, drawData.toY);
          ctx.stroke();
          break;
        default:
          ctx.moveTo(drawData.fromX, drawData.fromY);
          ctx.lineTo(drawData.toX, drawData.toY);
          ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getTouchPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!isJoined) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = e.type.includes('touch') ? getTouchPos(e) : getMousePos(e);
    setLastPos(pos);

    if (drawingShape !== 'free') {
      setStartShapePos(pos);
      setTempCanvasImage(canvasRef.current.getContext('2d').getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    } else {
      const ctx = canvasRef.current.getContext('2d');
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
          eraserSize,
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
        eraserSize
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

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (socket && socket.connected) {
      socket.emit('clear_board');
    }
  };

  // Passkey generator
  const handleGenerateKey = () => {
    const gen = Math.random().toString(36).substr(2, 8).toUpperCase();
    setPassKey(gen);
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Room key copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy. Please copy manually: ' + text);
    });
  };

  // Download
  const handleDownload = () => {
    const canvas = canvasRef.current;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = 'whiteboard.png';
    link.click();
  };

  // Undo Logic
  const handleUndo = () => {
    if (socket) socket.emit('undo');
  };

  // Chat submit
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', {
      name: username || `User`,
      text: chatInput
    });
    setChatInput('');
  };

  // UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Room Selection */}
      {!isJoined && (
        <div className="bg-white shadow-2xl p-8 rounded-xl max-w-lg mx-auto my-16 border-2 border-blue-300">
          <h2 className="text-3xl mb-8 font-bold text-center text-gray-800">Join Whiteboard Room</h2>
          <div className="flex justify-center mb-6 gap-4">
            <button
              className={`px-6 py-3 rounded-lg text-lg font-bold border-2 ${
                roomType === 'public'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105'
                  : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
              }`}
              onClick={() => setRoomType('public')}
            >🌐 Public Room</button>
            <button
              className={`px-6 py-3 rounded-lg text-lg font-bold border-2 ${
                roomType === 'private'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-lg transform scale-105'
                  : 'bg-white text-purple-600 border-purple-600 hover:bg-purple-50'
              }`}
              onClick={() => setRoomType('private')}
            >🔒 Private Room</button>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Your Name (optional)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="border px-4 py-2 rounded-lg font-bold text-gray-800 bg-gray-100 w-full mb-3"
            />
            {/* Private Room Options */}
            {roomType === 'private' && (
              <div className="space-y-6">
                {/* Key Option Selection */}
                <div className="flex justify-center gap-4 mb-4">
                  <button
                    className={`px-4 py-2 rounded-lg font-semibold border-2 ${
                      keyOption === 'generate'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                    }`}
                    onClick={() => setKeyOption('generate')}
                  >
                    🎲 Generate New Key
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg font-semibold border-2 ${
                      keyOption === 'paste'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                    }`}
                    onClick={() => setKeyOption('paste')}
                  >
                    📋 Join with Key
                  </button>
                </div>
                {keyOption === 'generate' && (
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 mb-3">
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg mb-2 w-full"
                      onClick={handleGenerateKey}
                    >
                      🎲 Generate Room Key
                    </button>
                    {passKey && (
                      <div className="flex items-center gap-2">
                        <input
                          value={passKey}
                          readOnly
                          className="flex-1 font-mono text-lg px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-800 font-bold"
                        />
                        <button
                          onClick={() => copyToClipboard(passKey)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold"
                        >
                          📋 Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {keyOption === 'paste' && (
                  <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                    <input
                      type="text"
                      placeholder="Paste room key here..."
                      value={passKey}
                      onChange={e => setPassKey(e.target.value.toUpperCase())}
                      className="w-full font-mono text-lg px-3 py-3 border-2 border-gray-400 rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            className={`w-full text-xl font-bold px-8 py-4 rounded-xl mt-6 transition-all ${
              (roomType === 'private' && !passKey)
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg transform hover:scale-105'
            }`}
            disabled={roomType === 'private' && !passKey}
            onClick={() => setIsJoined(true)}
          >
            🚀 Join Room
          </button>
        </div>
      )}

      {/* Whiteboard UI */}
      {isJoined && (
        <>
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-blue-200 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">Realtime Collaborative Whiteboard</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                  <span className="text-sm font-semibold text-gray-700">
                    {userCount} user{userCount !== 1 ? 's' : ''} online
                  </span>
                </div>
                <button
                  onClick={clearBoard}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
                >
                  🗑️ Clear
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  📥 Download
                </button>
                <button
                  onClick={handleUndo}
                  className="px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  ↩️ Undo
                </button>
              </div>
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="bg-white shadow-sm border-b border-blue-200 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
              {/* Tools */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Tool:</span>
                  <button
                    onClick={() => setCurrentTool('pen')}
                    className={`px-3 py-2 rounded-lg font-bold transition-all ${currentTool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-blue-200'}`}
                  >✏️ Pen</button>
                  <button
                    onClick={() => setCurrentTool('eraser')}
                    className={`px-3 py-2 rounded-lg font-bold transition-all ${currentTool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-blue-200'}`}
                  >🧽 Eraser</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Shape:</span>
                  {['free', 'rectangle', 'circle', 'line'].map(shape => (
                    <button
                      key={shape}
                      onClick={() => setDrawingShape(shape)}
                      className={`px-3 py-2 rounded-lg font-bold transition-all ${drawingShape === shape ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-purple-200'}`}
                    >
                      {shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Color:</span>
                  <div className="flex gap-2">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setCurrentColor(color)}
                        className={`w-10 h-10 rounded-full border-4 ${currentColor === color ? 'border-gray-800 scale-110' : 'border-gray-300 hover:border-gray-500'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                {currentTool === 'pen' && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Style:</span>
                    <select
                      value={pencilType}
                      onChange={e => setPencilType(e.target.value)}
                      className="px-2 py-1 border-2 border-gray-400 rounded-lg font-bold text-gray-800"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-700">
                  {currentTool === 'eraser' ? 'Eraser Size:' : 'Brush Size:'}
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
                  className="w-32 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-semibold text-gray-700 w-12">
                  {currentTool === 'eraser' ? eraserSize : currentSize}px
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-row max-w-7xl mx-auto mt-4 pb-10">
            {/* Canvas */}
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-200">
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
                style={{ touchAction: 'none', background: "#fff" }}
              />
            </div>
            {/* Chat */}
            <div className="ml-6 w-[350px] hidden md:block">
              <div className="bg-white rounded-2xl shadow-lg p-4 min-h-full border-2 border-blue-200 flex flex-col">
                <h3 className="font-black mb-2 text-blue-700 text-lg">💬 Chat Room</h3>
                <div className="flex-1 overflow-y-auto mb-2 border-b pb-2 max-h-[380px]">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="mb-1">
                      <span className="font-bold text-blue-700">{msg.name}:</span>
                      <span className='ml-2 text-gray-900'>{msg.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChat}>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded focus:ring text-gray-900"
                    style={{ backgroundColor: "#f9fafb" }}
                    placeholder="Type and Enter to send..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                  />
                </form>
              </div>
            </div>
          </div>
          <div className='text-center py-4 text-gray-600 font-semibold'>
            ⚡ Created by Ranjeet Kumar
          </div>
        </>
      )}

      {/* Connection Status */}
      {isJoined && !isConnected && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 border-2 border-red-700">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
            <span className="font-bold">🔄 Reconnecting to server...</span>
          </div>
        </div>
      )}
    </div>
  );
}
