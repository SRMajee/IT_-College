// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 100 * 1024 * 1024 });

app.use(express.static(path.join(__dirname, "public")));

// Store room assignments: Map<WebSocket, Set<roomName>>
const clientRooms = new Map();
// Store usernames: Map<WebSocket, username>
const clientNames = new Map();

wss.on("connection", (ws) => {
  console.log("User Connected");
  clientRooms.set(ws, new Set());
  clientNames.set(ws, "Anonymous"); // Default name

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        // (i) Join Group
        case "join_group":
          const { room, username } = payload;

          // Update Server Records
          clientRooms.get(ws).add(room);
          clientNames.set(ws, username); // Save the name for later (disconnects)

          // 1. Notify the USER they joined
          sendToClient(ws, {
            type: "system_message",
            payload: `You joined group: ${room}`,
          });

          // 2. Notify the ROOM that user joined
          broadcastToRoom(room, {
            type: "group_notification",
            payload: {
              message: `${username} has joined the group!`,
              room: room,
            },
          });
          break;

        // (ii) Public Upload
        case "public_upload":
          broadcastToAll({
            type: "receive_public",
            payload: payload,
          });
          break;

        // (iii) Group Upload
        case "group_upload":
          broadcastToRoom(payload.room, {
            type: "receive_group",
            payload: payload,
          });
          break;
      }
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  });

  // Handle Disconnect / Leave
  ws.on("close", () => {
    const username = clientNames.get(ws) || "Anonymous";
    const rooms = clientRooms.get(ws);

    if (rooms) {
      // Notify every room this user was in
      for (const room of rooms) {
        broadcastToRoom(room, {
          type: "group_notification",
          payload: { message: `${username} has left the group.`, room: room },
        });
      }
    }

    console.log("User Disconnected");
    clientRooms.delete(ws);
    clientNames.delete(ws);
  });
});

// --- Helpers ---

function sendToClient(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcastToAll(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
  });
}

function broadcastToRoom(room, data) {
  wss.clients.forEach((client) => {
    const rooms = clientRooms.get(client);
    if (client.readyState === WebSocket.OPEN && rooms && rooms.has(room)) {
      client.send(JSON.stringify(data));
    }
  });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
