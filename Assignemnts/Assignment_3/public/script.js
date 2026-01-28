const socket = io();

let currentMode = "global";
let currentRoom = "";

const STORAGE_KEY_USER = "chat_app_username";
const STORAGE_KEY_GLOBAL = "chat_history_global";
const STORAGE_KEY_GROUP_PREFIX = "chat_history_group_";

window.onload = () => {
  const savedUser = localStorage.getItem(STORAGE_KEY_USER);
  if (savedUser) {
    document.getElementById("username").value = savedUser;
  }
  loadMessagesFromStorage("global");
  socket.emit("request_global_history");
};


function setMode(mode) {
  currentMode = mode;
  document.getElementById("btn-global").className =
    mode === "global" ? "active" : "";
  document.getElementById("btn-group").className =
    mode === "group" ? "active" : "";

  const grpControls = document.getElementById("group-controls");
  const grpStatus = document.getElementById("group-status");

  document.getElementById("chat-window").innerHTML = "";

  if (mode === "group") {
    grpControls.style.display = "flex";
    grpStatus.style.display = "block";
    if (currentRoom) {
      addSystemMessage(`Active Group: ${currentRoom}`);
      loadMessagesFromStorage(currentRoom);
    } else {
      addSystemMessage("Create or Join a group to start.");
    }
  } else {
    grpControls.style.display = "none";
    grpStatus.style.display = "none";
    loadMessagesFromStorage("global");
    socket.emit("request_global_history");
  }
}

document.getElementById("username").addEventListener("input", (e) => {
  localStorage.setItem(STORAGE_KEY_USER, e.target.value);
});

const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    document.getElementById("file-preview").style.display = "flex";
    document.getElementById("file-name").innerText = fileInput.files[0].name;
  }
});

function clearFile() {
  fileInput.value = "";
  document.getElementById("file-preview").style.display = "none";
}

function handleEnter(event) {
  if (event.key === "Enter") sendMessage();
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}


function createGroup() {
  const room = document.getElementById("roomInput").value.trim();
  const user = document.getElementById("username").value.trim();

  if (!user) return alert("Please enter your name first!");
  if (!room) return alert("Enter a room name!");

  socket.emit("create_group", { room, username: user });
}

function joinGroup() {
  const room = document.getElementById("roomInput").value.trim();
  const user = document.getElementById("username").value.trim();

  if (!user) return alert("Please enter your name first!");
  if (!room) return alert("Enter a room name!");

  socket.emit("join_group", { room, username: user });
}

async function sendMessage() {
  const msgInput = document.getElementById("msgInput");
  const text = msgInput.value;
  const file = fileInput.files[0];
  const user = document.getElementById("username").value.trim();

  if (!user) return alert("Please enter your name!");
  if (!text && !file) return;

  localStorage.setItem(STORAGE_KEY_USER, user);

  let imageBase64 = null;
  if (file) {
    imageBase64 = await getBase64(file);
  }

  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const payload = {
    id: msgId,
    username: user,
    text: text,
    image: imageBase64,
    room: currentMode === "group" ? currentRoom : null,
  };

  if (currentMode === "global") {
    socket.emit("public_message", payload);
  } else {
    if (!currentRoom) return alert("Join a group first!");
    socket.emit("group_message", payload);
  }

  msgInput.value = "";
  clearFile();
}


function deleteMessage(id) {
  if (!confirm("Delete this message?")) return;
  socket.emit("delete_message", { id, mode: currentMode, room: currentRoom });
}

function editMessage(id, oldText) {
  const newText = prompt("Edit your message:", oldText);
  if (newText !== null && newText !== oldText) {
    socket.emit("edit_message", {
      id,
      mode: currentMode,
      room: currentRoom,
      newText,
    });
  }
}


function getStorageKey(context) {
  return context === "global"
    ? STORAGE_KEY_GLOBAL
    : STORAGE_KEY_GROUP_PREFIX + context;
}

function updateStorage(context, callback) {
  const key = getStorageKey(context);
  let history = JSON.parse(localStorage.getItem(key) || "[]");
  history = callback(history);
  localStorage.setItem(key, JSON.stringify(history));
}


socket.on("group_success", (room) => {
  currentRoom = room;
  document.getElementById("group-status").innerHTML =
    `Current Group: <b>${room}</b>`;
  document.getElementById("chat-window").innerHTML = "";
  loadMessagesFromStorage(room);
});

socket.on("group_error", (msg) => {
  alert(msg);
});

socket.on("history_response", (historyData) => {
  const context = currentMode === "global" ? "global" : currentRoom;
  if (!context) return;

  if (historyData.length > 0) {
    localStorage.setItem(getStorageKey(context), JSON.stringify(historyData));
    document.getElementById("chat-window").innerHTML = "";
    historyData.forEach((msg) => appendMessage(msg));
  }
});

socket.on("receive_public", (data) => {
  updateStorage("global", (history) => {
    history.push(data);
    if (history.length > 50) history.shift();
    return history;
  });
  if (currentMode === "global") appendMessage(data);
});

socket.on("receive_group", (data) => {
  if (currentRoom) {
    updateStorage(currentRoom, (history) => {
      history.push(data);
      if (history.length > 50) history.shift();
      return history;
    });
  }
  if (currentMode === "group") appendMessage(data);
});

socket.on("message_deleted", ({ id }) => {
  const el = document.getElementById(`msg-${id}`);
  if (el) el.remove();
  const context = currentMode === "global" ? "global" : currentRoom;
  updateStorage(context, (history) => history.filter((m) => m.id !== id));
});

socket.on("message_updated", ({ id, newText }) => {
  const textEl = document.querySelector(`#msg-${id} .msg-text`);
  if (textEl) textEl.innerText = newText + " (edited)";
  const context = currentMode === "global" ? "global" : currentRoom;
  updateStorage(context, (history) => {
    const msg = history.find((m) => m.id === id);
    if (msg) msg.text = newText;
    return history;
  });
});

socket.on("system_message", (msg) => {
  if (currentMode === "group") addSystemMessage(msg);
});

// --- UI Rendering ---

function appendMessage(data) {
  const chat = document.getElementById("chat-window");
  if (document.getElementById(`msg-${data.id}`)) return;

  const div = document.createElement("div");
  div.id = `msg-${data.id}`;

  const myName = document.getElementById("username").value.trim();
  const isMe = myName !== "" && data.username === myName;

  div.className = isMe ? "message self" : "message other";

  let content = `<div class="msg-header">
                    <span class="meta">${isMe ? "You" : data.username}</span>`;

  if (isMe) {
    const safeText = (data.text || "").replace(/'/g, "\\'");
    content += `
        <div class="msg-actions">
            <i class="fas fa-edit" onclick="editMessage('${data.id}', '${safeText}')"></i>
            <i class="fas fa-trash" onclick="deleteMessage('${data.id}')"></i>
        </div>`;
  }
  content += `</div>`;

  if (data.image) {
    content += `<img src="${data.image}" class="msg-img" />`;
  }
  if (data.text) {
    content += `<div class="msg-text">${data.text}</div>`;
  }

  div.innerHTML = content;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addSystemMessage(msg) {
  const chat = document.getElementById("chat-window");
  const div = document.createElement("div");
  div.className = "message system-msg";
  div.innerText = msg;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function loadMessagesFromStorage(context) {
  const key = getStorageKey(context);
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  const chat = document.getElementById("chat-window");
  chat.innerHTML = "";
  history.forEach((msg) => appendMessage(msg));
}
