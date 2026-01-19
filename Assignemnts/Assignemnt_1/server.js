const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 5555;
const ADMIN_PASSWORD = "admin123";
const ADMIN_TOKEN = "MANAGER_ACCESS_GRANTED_TOKEN_99";

// --- 1. SETUP EJS ---
app.set("view engine", "ejs");
// Tell Express where to find the 'views' folder
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.json());
// We can still serve static files (like CSS/images) from public if needed
app.use(express.static(path.join(__dirname, "public")));

// --- In-Memory Data Store ---
const dataStore = {};

const getStore = (ip) => {
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

// NEW: Render the EJS Page
app.get("/", (req, res) => {
    // This looks for 'views/index.ejs' and renders it
    res.render("index");
});

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
  
  const cleanIp = req.ip === "::1" ? "127.0.0.1" : req.ip.replace("::ffff:", "");
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
      console.log(`[Manager] Accessing Target: [${targetIp}]`);
      storeToRead = getStore(targetIp);
    } else {
      return res.status(403).json({ value: "ACCESS DENIED: Manager role required" });
    }
  } else {
    storeToRead = getStore(req.ip);
  }

  const value = storeToRead[key];
  const cleanIp = req.ip === "::1" ? "127.0.0.1" : req.ip.replace("::ffff:", "");
  console.log(`[${cleanIp}] GET: ${key} -> ${value || "<blank>"}`);

  res.json({ value: value ? value : "<blank>" });
});

// Listen on 0.0.0.0 for network access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running!`);
  console.log(`- Local: http://localhost:${PORT}`);
  console.log(`- Network: Make sure to use your LAN IP (e.g., 192.168.29.7)`);
});