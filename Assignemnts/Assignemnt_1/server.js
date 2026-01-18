const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 5555;
const ADMIN_PASSWORD = "admin123";
const ADMIN_TOKEN = "MANAGER_ACCESS_GRANTED_TOKEN_99";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- In-Memory Data Store ---
const dataStore = {};

const getStore = (ip) => {
  // FIX 2: Better IP Normalization
  // If IP is localhost (::1), make it 127.0.0.1
  // If IP is IPv6 mapped (::ffff:192.168.x.x), strip the prefix to get just the numbers
  let clientIp = ip;
  if (clientIp === "::1") {
    clientIp = "127.0.0.1";
  } else if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.replace("::ffff:", "");
  }

  if (!dataStore[clientIp]) {
    dataStore[clientIp] = {};
  }
  return dataStore[clientIp];
};

// --- Routes ---

app.post("/api/auth", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({
      status: "SUCCESS",
      token: ADMIN_TOKEN,
      message: "You are now a Manager",
    });
  } else {
    res.status(401).json({ status: "FAIL", message: "Incorrect Password" });
  }
});

app.post("/api/put", (req, res) => {
  const { key, value } = req.body;
  const store = getStore(req.ip);

  if (!key || !value) return res.status(400).json({ message: "Missing data" });

  store[key] = value;
  // Log the CLEAN IP so you know exactly what to type in the Manager box
  const cleanIp =
    req.ip === "::1" ? "127.0.0.1" : req.ip.replace("::ffff:", "");
  console.log(`[${cleanIp}] PUT: ${key} = ${value}`);

  res.json({ status: "OK", message: `Stored ${key}` });
});

app.get("/api/get", (req, res) => {
  const { key, targetIp } = req.query;
  const clientToken = req.headers["x-auth-token"];

  if (!key) return res.status(400).json({ message: "Key is required" });

  let storeToRead;

  if (targetIp) {
    if (clientToken === ADMIN_TOKEN) {
      // Manager is requesting specific IP
      console.log(`[Manager] Accessing Target: [${targetIp}]`);
      storeToRead = getStore(targetIp);
    } else {
      return res
        .status(403)
        .json({ value: "ACCESS DENIED: Manager role required" });
    }
  } else {
    // Guest reading own store
    storeToRead = getStore(req.ip);
  }

  const value = storeToRead[key];
  // Log the CLEAN IP
  const cleanIp =
    req.ip === "::1" ? "127.0.0.1" : req.ip.replace("::ffff:", "");
  console.log(`[${cleanIp}] GET: ${key} -> ${value || "<blank>"}`);

  res.json({ value: value ? value : "<blank>" });
});

// FIX 1: Listen on '0.0.0.0' explicitly to force IPv4 access from other computers
app.listen(PORT, () => {
  console.log(`Server is running!`);
  console.log(`- Local: http://localhost:${PORT}`);
  console.log(`- Network: http://192.168.29.193:${PORT}`);
});
