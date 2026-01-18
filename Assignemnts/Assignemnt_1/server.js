const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 5555;
const ADMIN_PASSWORD = "admin123";
const ADMIN_TOKEN = "MANAGER_ACCESS_GRANTED_TOKEN_99"; // Simple secret token

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- In-Memory Data Store ---
const dataStore = {};

const getStore = (ip) => {
    // Normalize IP (::1 is localhost in IPv6)
    const clientIp = (ip === '::1') ? '127.0.0.1' : ip;
    if (!dataStore[clientIp]) {
        dataStore[clientIp] = {};
    }
    return dataStore[clientIp];
};

// --- Routes ---

// 1. LOGIN (Get Manager Role)
app.post('/api/auth', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // Return a token that the client must save
        res.json({ status: "SUCCESS", token: ADMIN_TOKEN, message: "You are now a Manager" });
    } else {
        res.status(401).json({ status: "FAIL", message: "Incorrect Password" });
    }
});

// 2. PUT (Always saves to your own IP)
app.post('/api/put', (req, res) => {
    const { key, value } = req.body;
    const store = getStore(req.ip); // Always uses requester's IP

    if (!key || !value) return res.status(400).json({ message: "Missing data" });

    store[key] = value;
    console.log(`[${req.ip}] PUT: ${key} = ${value}`);
    res.json({ status: "OK", message: `Stored ${key}` });
});

// 3. GET (Can retrieve own data OR others' data if Manager)
app.get('/api/get', (req, res) => {
    const { key, targetIp } = req.query;
    const clientToken = req.headers['x-auth-token']; // Read token from header

    if (!key) return res.status(400).json({ message: "Key is required" });

    let storeToRead;

    // LOGIC: If targetIp is requested, check Authorization
    if (targetIp) {
        if (clientToken === ADMIN_TOKEN) {
            console.log(`[${req.ip}] MANAGER ACCESS -> Target: [${targetIp}]`);
            storeToRead = getStore(targetIp);
        } else {
            return res.status(403).json({ value: "ACCESS DENIED: Manager role required" });
        }
    } else {
        // Default: Read own store
        storeToRead = getStore(req.ip);
    }

    const value = storeToRead[key];
    console.log(`[${req.ip}] GET: ${key} -> ${value || '<blank>'}`);
    
    res.json({ value: value ? value : "<blank>" });
});

app.listen(PORT, () => {
    console.log(`Web Server running at http://localhost:${PORT}`);
});