// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 100 * 1024 * 1024 });

app.use(express.static(path.join(__dirname, "public")));

// --- DATA STRUCTURES ---

// Store room assignments: Map<WebSocket, Set<roomName>>
const clientRooms = new Map();
// Store usernames: Map<WebSocket, username>
const clientNames = new Map();

// QUEUES: Store only the last 5 messages
// Structure: [Newest, ..., Oldest]
const MAX_HISTORY = 4;
const publicQueue = [];
const groupQueues = new Map();

function addToQueue(queue, message) {
  // Add new message to the front (Index 0 is newest)
  queue.unshift(message);
  // Keep only top 5
  if (queue.length > MAX_HISTORY) {
    queue.pop();
  }
}

function getGroupQueue(room) {
  if (!groupQueues.has(room)) {
    groupQueues.set(room, []);
  }
  return groupQueues.get(room);
}

// --- WEBSOCKET LOGIC ---

wss.on("connection", (ws) => {
  console.log("User Connected");
  clientRooms.set(ws, new Set());
  clientNames.set(ws, "Anonymous");

  // 1. Send existing Public History (Top 5)
  // Loop backwards: sends Oldest first, Newest last.
  // Client will appendChild, resulting in Oldest at Top, Newest at Bottom.
  for (let i = publicQueue.length - 1; i >= 0; i--) {
    sendToClient(ws, { type: "receive_public", payload: publicQueue[i] });
  }

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        // (i) Join Group
        case "join_group":
          const { room, username } = payload;
          clientRooms.get(ws).add(room);
          clientNames.set(ws, username);

          sendToClient(ws, {
            type: "system_message",
            payload: `You joined group: ${room}`,
          });

          broadcastToRoom(room, {
            type: "group_notification",
            payload: {
              message: `${username} has joined the group!`,
              room: room,
            },
          });

          // Send Group History
          const gQueue = getGroupQueue(room);
          for (let i = gQueue.length - 1; i >= 0; i--) {
            sendToClient(ws, { type: "receive_group", payload: gQueue[i] });
          }
          break;

        // (ii) Public Upload
        case "public_upload":
          const publicMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            ...payload,
          };
          addToQueue(publicQueue, publicMsg);
          broadcastToAll({ type: "receive_public", payload: publicMsg });
          break;

        // (iii) Group Upload
        case "group_upload":
          const groupMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            ...payload,
          };
          const specificQueue = getGroupQueue(payload.room);
          addToQueue(specificQueue, groupMsg);
          broadcastToRoom(payload.room, {
            type: "receive_group",
            payload: groupMsg,
          });
          break;
      }
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  });

  ws.on("close", () => {
    const username = clientNames.get(ws) || "Anonymous";
    const rooms = clientRooms.get(ws);
    if (rooms) {
      for (const room of rooms) {
        broadcastToRoom(room, {
          type: "group_notification",
          payload: { message: `${username} has left the group.`, room: room },
        });
      }
    }
    clientRooms.delete(ws);
    clientNames.delete(ws);
  });
});

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
