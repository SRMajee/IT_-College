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
  } else if (type === "system_message") {
    addNotification("group-feed", payload);
  } else if (type === "group_notification") {
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

// --- SCROLL & QUEUE MANAGEMENT ---

function scrollToBottom(feedId) {
  const feed = document.getElementById(feedId);
  feed.scrollTop = feed.scrollHeight;
}

function pruneFeed(feedId) {
  const feed = document.getElementById(feedId);
  while (feed.children.length > 4) {
    feed.removeChild(feed.firstElementChild);
  }
}

// --- SENDING LOGIC ---

async function sendPublic() {
  const fileInput = document.getElementById("publicFile");
  const commentInput = document.getElementById("publicComment");
  const comment = commentInput.value.trim();

  if (fileInput.files.length === 0 && !comment) return alert("Empty post!");
  if (fileInput.files.length === 0) {
    return alert("You must upload an image to post!");
  }
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

function joinGroup() {
  const room = document.getElementById("roomInput").value;
  if (!room) return alert("Enter a room name!");
  currentRoom = room;
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

// --- INLINE REPLY LOGIC ---

function toggleReplyBox(id) {
  const box = document.getElementById(`reply-box-${id}`);
  if (box.style.display === "none") {
    box.style.display = "block";
  } else {
    box.style.display = "none";
  }
}

async function submitInlineReply(
  scope,
  parentId,
  parentUsername,
  parentSnippet,
) {
  const commentInput = document.getElementById(`reply-comment-${parentId}`);
  const fileInput = document.getElementById(`reply-file-${parentId}`);
  const comment = commentInput.value.trim();

  if (fileInput.files.length === 0 && !comment) return alert("Empty reply!");

  let imageBase64 = null;
  if (fileInput.files.length > 0)
    imageBase64 = await getBase64(fileInput.files[0]);

  const payload = {
    username: getUser(),
    image: imageBase64,
    comment: comment,
    replyTo: {
      id: parentId,
      username: parentUsername,
      snippet: parentSnippet,
    },
  };

  if (scope === "public") {
    ws.send(JSON.stringify({ type: "public_upload", payload: payload }));
  } else {
    if (!currentRoom) return alert("Connection lost, rejoin group.");
    payload.room = currentRoom;
    ws.send(JSON.stringify({ type: "group_upload", payload: payload }));
  }

  commentInput.value = "";
  fileInput.value = "";
  toggleReplyBox(parentId);
}

// --- UI Helpers ---

function addToFeed(feedId, data) {
  const feed = document.getElementById(feedId);
  const div = document.createElement("div");
  div.className = "post";

  const scope = feedId === "public-feed" ? "public" : "group";

  const rawComment = data.comment || "";
  const snippet =
    rawComment.length > 20
      ? rawComment.substring(0, 20) + "..."
      : rawComment || "Image";
  const safeSnippet = snippet.replace(/"/g, "&quot;");
  const safeUsername = data.username.replace(/"/g, "&quot;");

  let content = "";

  if (data.replyTo) {
    content += `
      <div class="reply-header">
         Replying to <strong>${data.replyTo.username}</strong>: "${data.replyTo.snippet}"
      </div>
    `;
  }

  content += `<div class="meta">${data.username} wrote:</div>`;
  if (data.image) content += `<img src="${data.image}" />`;
  if (data.comment) content += `<div class="comment">"${data.comment}"</div>`;

  content += `
    <div class="actions">
      <button class="btn-reply" onclick="toggleReplyBox('${data.id}')">Reply</button>
    </div>
    <div id="reply-box-${data.id}" class="inline-reply-box" style="display:none;">
      <input type="text" id="reply-comment-${data.id}" placeholder="Write a reply..." class="reply-input" />
      <div class="reply-controls">
        <input type="file" id="reply-file-${data.id}" accept="image/*" class="reply-file-sm" />
        <button onclick="submitInlineReply('${scope}', '${data.id}', '${safeUsername}', '${safeSnippet}')">Send Reply</button>
      </div>
    </div>
  `;

  div.innerHTML = content;

  // CHANGED: Use appendChild to put new messages at the bottom
  feed.appendChild(div);

  pruneFeed(feedId);
  scrollToBottom(feedId);
}

function addNotification(feedId, message) {
  const feed = document.getElementById(feedId);
  const div = document.createElement("div");
  div.className = "notification";
  div.innerText = message;

  // Notifications also go to the bottom now
  feed.appendChild(div);
  scrollToBottom(feedId);
}
