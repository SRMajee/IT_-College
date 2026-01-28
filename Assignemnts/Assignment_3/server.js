const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB limit
});

app.use(express.static(path.join(__dirname, "public")));

// --- IN-MEMORY STORAGE ---
let globalHistory = [];
const groupHistory = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. Initial History Load
  socket.emit("history_response", globalHistory);

  // 2. Global Message
  socket.on("public_message", (data) => {
    globalHistory.push(data);
    if (globalHistory.length > 50) globalHistory.shift();
    io.emit("receive_public", data);
  });

  // 3. Request Global History
  socket.on("request_global_history", () => {
    socket.emit("history_response", globalHistory);
  });

  socket.on("create_group", (data) => {
    const { room, username } = data;

    // Check if group already exists
    if (groupHistory[room]) {
      socket.emit(
        "group_error",
        `Group '${room}' already exists! Try joining it.`,
      );
      return;
    }

    groupHistory[room] = [];

    // Join logic
    joinRoomInternal(socket, room, username);
  });

  socket.on("join_group", (data) => {
    const { room, username } = data;

    // Check if group exists
    if (!groupHistory[room]) {
      socket.emit(
        "group_error",
        `Group '${room}' does not exist! Create it first.`,
      );
      return;
    }

    joinRoomInternal(socket, room, username);
  });

  function joinRoomInternal(socket, room, username) {
    if (socket.currentRoom) socket.leave(socket.currentRoom);

    socket.join(room);
    socket.currentRoom = room;
    socket.username = username;

    socket.emit("group_success", room);

    socket.emit("history_response", groupHistory[room]);

    socket
      .to(room)
      .emit("system_message", `${socket.username} has joined the group.`);
    socket.emit("system_message", `You joined group: ${room}`);
  }

  // 5. Group Message
  socket.on("group_message", (data) => {
    const { room } = data;

    if (!groupHistory[room]) return;

    groupHistory[room].push(data);
    if (groupHistory[room].length > 50) groupHistory[room].shift();

    io.to(room).emit("receive_group", data);
  });

  socket.on("delete_message", (data) => {
    const { id, room, mode } = data;
    if (mode === "global") {
      globalHistory = globalHistory.filter((msg) => msg.id !== id);
      io.emit("message_deleted", { id });
    } else {
      if (groupHistory[room]) {
        groupHistory[room] = groupHistory[room].filter((msg) => msg.id !== id);
        io.to(room).emit("message_deleted", { id });
      }
    }
  });

  // --- EDIT MESSAGE ---
  socket.on("edit_message", (data) => {
    const { id, room, mode, newText } = data;
    const updateMsg = (list) => {
      const msg = list.find((m) => m.id === id);
      if (msg) {
        msg.text = newText;
        return true;
      }
      return false;
    };

    if (mode === "global") {
      if (updateMsg(globalHistory)) io.emit("message_updated", { id, newText });
    } else {
      if (groupHistory[room] && updateMsg(groupHistory[room])) {
        io.to(room).emit("message_updated", { id, newText });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
