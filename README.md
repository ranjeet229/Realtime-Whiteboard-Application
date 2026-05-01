# 🎨 Realtime Whiteboard (CanvasQuill)
**Deploy Link:** [https://canvasapp-beryl.vercel.app/](https://canvasapp-beryl.vercel.app/)  

A collaborative whiteboard application built with **Next.js**, **Express.js**, and **WebSockets** that lets multiple users draw together in real time.  
It supports freehand drawing, erasing, color selection, and shape tools, all synced instantly across connected users.

---

## 🚀 Features

- **Real-time Collaboration** – See everyone's drawings update instantly via WebSockets.
- **Multiple Tools** – Pen, eraser, and shape tools (rectangle, circle, etc.).
- **Color Picker** – Select from a range of colors.
- **Size Adjustment** – Change brush and eraser size.
- **Responsive Design** – Works seamlessly on desktop, tablet, and mobile.
- **First-time Auto Refresh** – Ensures a stable initial connection.
- **Dynamic Import** – Avoids SSR issues with Next.js canvas rendering.

---

## 🛠️ Tech Stack

**Frontend**
- [Next.js](https://nextjs.org/) – React framework for building the UI.
- [Tailwind CSS](https://tailwindcss.com/) – Utility-first styling.
- HTML5 Canvas API – Handles all drawing logic.

**Backend**
- [Express.js](https://expressjs.com/) – Server framework.
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) / [Socket.IO](https://socket.io/) – Real-time communication.

---
