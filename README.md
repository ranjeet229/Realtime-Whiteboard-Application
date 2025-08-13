# 🖌️ RealTime Whiteboard

A collaborative whiteboard application built with **Next.js**, **Express.js**, and **WebSockets** that allows multiple users to draw together in real time.  
This app supports freehand drawing, erasing, color selection, and shape tools, all synced instantly across connected users.

---

## 🚀 Features

- **Real-time Collaboration** – Draw and see updates instantly with WebSockets.
- **Multiple Tools** – Pen, eraser, and shape drawing (rectangle, circle, etc.).
- **Color Picker** – Choose from multiple colors for your drawings.
- **Size Adjustment** – Change brush/eraser size.
- **Responsive Design** – Works on desktop, tablet, and mobile.
- **First-time Auto Refresh** – Ensures correct initial connection setup.
- **Dynamic Import** – Avoids SSR issues with Next.js canvas rendering.

---

## 🛠️ Tech Stack

**Frontend**
- [Next.js](https://nextjs.org/) – React framework for UI
- [Tailwind CSS](https://tailwindcss.com/) – Styling
- HTML5 Canvas API – Drawing logic

**Backend**
- [Express.js](https://expressjs.com/) – Server
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) / [Socket.IO](https://socket.io/) – Real-time communication

---

## 📂 Project Structure
-**project-root/
│── backend/ # Express.js server & WebSocket logic
│── components/ # React components (Whiteboard, Toolbar, etc.)
│── pages/ # Next.js pages
│── public/ # Static assets
│── styles/ # Global styles
│── package.json # Dependencies & scripts**

