const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${window.location.host}`);

let currentRoom = "";

ws.onopen = () => console.log("Connected to WebSocket");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const { type, payload } = data;

  if (type === "receive_public") {
    addToFeed("public-feed", payload);
  } else if (type === "receive_group") {
    addToFeed("group-feed", payload);
  }
  // CHANGE 1: Render "You joined" in the HTML feed instead of an alert
  else if (type === "system_message") {
    addNotification("group-feed", payload);
  }
  // Handle "User joined/left" notifications
  else if (type === "group_notification") {
    addNotification("group-feed", payload.message);
  }
};

// --- Logic ---

function getUser() {
  return document.getElementById("username").value || "Anonymous";
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// --- Public Logic ---

async function sendPublic() {
  const fileInput = document.getElementById("publicFile");
  const commentInput = document.getElementById("publicComment");
  const comment = commentInput.value.trim();

  if (fileInput.files.length === 0 && !comment) return alert("Empty post!");

  let imageBase64 = null;
  if (fileInput.files.length > 0)
    imageBase64 = await getBase64(fileInput.files[0]);

  ws.send(
    JSON.stringify({
      type: "public_upload",
      payload: { username: getUser(), image: imageBase64, comment: comment },
    }),
  );

  fileInput.value = "";
  commentInput.value = "";
}

// --- Group Logic ---

function joinGroup() {
  const room = document.getElementById("roomInput").value;
  if (!room) return alert("Enter a room name!");

  currentRoom = room;

  // CHANGE 2: Clear the previous group chat when joining a new one
  document.getElementById("group-feed").innerHTML = "";

  ws.send(
    JSON.stringify({
      type: "join_group",
      payload: { room: room, username: getUser() },
    }),
  );
}

async function sendGroup() {
  if (!currentRoom) return alert("Join a group first!");

  const fileInput = document.getElementById("groupFile");
  const commentInput = document.getElementById("groupComment");
  const comment = commentInput.value.trim();

  if (fileInput.files.length === 0 && !comment) return alert("Empty post!");

  let imageBase64 = null;
  if (fileInput.files.length > 0)
    imageBase64 = await getBase64(fileInput.files[0]);

  ws.send(
    JSON.stringify({
      type: "group_upload",
      payload: {
        room: currentRoom,
        username: getUser(),
        image: imageBase64,
        comment: comment,
      },
    }),
  );

  fileInput.value = "";
  commentInput.value = "";
}

// --- UI Helpers ---

function addToFeed(feedId, data) {
  const feed = document.getElementById(feedId);
  const div = document.createElement("div");
  div.className = "post";

  let content = `<div class="meta">${data.username} wrote:</div>`;
  if (data.image) content += `<img src="${data.image}" />`;
  if (data.comment) content += `<div class="comment">"${data.comment}"</div>`;

  div.innerHTML = content;
  feed.prepend(div);
}

function addNotification(feedId, message) {
  const feed = document.getElementById(feedId);
  const div = document.createElement("div");
  div.className = "notification"; // Uses the grey styling from previous step
  div.innerText = message;
  feed.prepend(div);
}
