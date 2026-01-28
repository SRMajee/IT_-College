// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // Increase buffer size to allow larger images (100MB)
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // (i) Share with EVERYONE
  socket.on("public_upload", (data) => {
    // Re-emit to all connected clients
    io.emit("receive_public", data);
  });

  // (ii) Join a specific Group
  socket.on("join_group", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    socket.emit("system_message", `You joined group: ${room}`);
  });

  // (ii) Share with GROUP only
  socket.on("group_upload", (data) => {
    const { room, image, username, comment } = data;
    // Emit only to users in that room
    io.to(room).emit("receive_group", { image, username, comment });
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
