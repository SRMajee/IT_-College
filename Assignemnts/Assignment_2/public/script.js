const socket = io();

let currentRoom = "";

// Helper: Convert file to Base64
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function getUser() {
    return document.getElementById('username').value || "Anonymous";
}

// --- (i) Public Logic ---

async function sendPublic() {
    const fileInput = document.getElementById('publicFile');
    if (fileInput.files.length === 0) return alert("Select a file first!");

    const imageBase64 = await getBase64(fileInput.files[0]);
    
    socket.emit('public_upload', {
        image: imageBase64,
        username: getUser()
    });
    
    // Clear input
    fileInput.value = '';
}

socket.on('receive_public', (data) => {
    const feed = document.getElementById('public-feed');
    const post = createPostElement(data);
    feed.prepend(post);
});

// --- (ii) Group Logic ---

function joinGroup() {
    const room = document.getElementById('roomInput').value;
    if (!room) return alert("Enter a room name!");
    
    currentRoom = room;
    socket.emit('join_group', room);
}

async function sendGroup() {
    if (!currentRoom) return alert("Join a group first!");
    const fileInput = document.getElementById('groupFile');
    const commentInput = document.getElementById('groupComment');

    if (fileInput.files.length === 0) return alert("Select a file!");

    const imageBase64 = await getBase64(fileInput.files[0]);

    socket.emit('group_upload', {
        room: currentRoom,
        image: imageBase64,
        username: getUser(),
        comment: commentInput.value
    });

    fileInput.value = '';
    commentInput.value = '';
}

socket.on('receive_group', (data) => {
    const feed = document.getElementById('group-feed');
    const post = createPostElement(data);
    feed.prepend(post);
});

socket.on('system_message', (msg) => {
    alert(msg);
});

// --- UI Helper ---
function createPostElement(data) {
    const div = document.createElement('div');
    div.className = 'post';
    
    let content = `<div class="meta">${data.username} says:</div>`;
    content += `<img src="${data.image}" />`;
    
    if (data.comment) {
        content += `<div class="comment">"${data.comment}"</div>`;
    }
    
    div.innerHTML = content;
    return div;
}