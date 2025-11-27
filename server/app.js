const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const USERS_FILE = path.join(__dirname, "data", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function ensureUserFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

function readUsers() {
  ensureUserFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
}

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const users = readUsers();
  const exists = users.find((u) => u.username === username);
  if (exists) {
    return res.status(400).json({ error: "Username already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { username, passwordHash, createdAt: new Date().toISOString() };
  users.push(newUser);
  writeUsers(users);

  const token = generateToken(username);
  return res.json({ username, token });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "User not found." });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid password." });
  }
  const token = generateToken(username);
  return res.json({ username, token });
});

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
}

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

const connectedUsers = new Map(); // socketId -> username
const rooms = new Map(); // roomId -> { password, players: [{ socketId, username, color }], fen }
const socketRooms = new Map(); // socketId -> roomId
const randomQueue = []; // socketIds waiting for random match

function broadcastUserList() {
  const uniqueUsers = Array.from(new Set(Array.from(connectedUsers.values())));
  io.emit("update_user_list", uniqueUsers);
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const usernameFromClient = socket.handshake.auth?.username || socket.handshake.query?.username;
  if (!token) {
    return next(new Error("Auth token required"));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { username: payload.username || usernameFromClient };
    return next();
  } catch (err) {
    return next(new Error("Token verification failed"));
  }
});

function removeFromRandomQueue(socketId) {
  for (let i = randomQueue.length - 1; i >= 0; i -= 1) {
    if (randomQueue[i] === socketId) {
      randomQueue.splice(i, 1);
    }
  }
}

function popActiveOpponent(excludeSocketId) {
  while (randomQueue.length > 0) {
    const opponentId = randomQueue.shift();
    if (opponentId === excludeSocketId) continue;
    const opponentSocket = io.sockets.sockets.get(opponentId);
    if (opponentSocket && opponentSocket.connected) {
      return opponentSocket;
    }
  }
  return null;
}

function joinRoom(socket, { roomId, password }, cb, allowCreate = false) {
  if (!roomId) {
    cb?.({ error: "roomId is required." });
    return;
  }

  const username = socket.user?.username;
  let room = rooms.get(roomId);

  if (!room) {
    if (!allowCreate) {
      cb?.({ error: "Room does not exist." });
      return;
    }
    room = { password: password || "", players: [], fen: START_FEN };
    rooms.set(roomId, room);
  }

  if (!room.fen) {
    room.fen = START_FEN;
  }

  if (room.password && room.password !== (password || "")) {
    cb?.({ error: "Wrong room password." });
    return;
  }

  const existing = room.players.find((p) => p.username === username);
  if (existing) {
    socket.join(roomId);
    socketRooms.set(socket.id, roomId);
    cb?.({ ok: true, color: existing.color, fen: room.fen });
    return;
  }

  if (room.players.length >= 2) {
    cb?.({ error: "Room is already full." });
    return;
  }

  const color = room.players.length === 0 ? "white" : "black";
  room.players.push({ socketId: socket.id, username, color });
  socket.join(roomId);
  socketRooms.set(socket.id, roomId);
  cb?.({ ok: true, color, fen: room.fen });
  socket.to(roomId).emit("opponent_joined", { username });
}

io.on("connection", (socket) => {
  const username = socket.user?.username || "unknown";
  connectedUsers.set(socket.id, username);
  broadcastUserList();

  socket.on("create_room", (payload, cb) => joinRoom(socket, payload || {}, cb, true));
  socket.on("join_room", (payload, cb) => joinRoom(socket, payload || {}, cb, false));

  socket.on("random_join", (cb) => {
    if (socketRooms.has(socket.id)) {
      cb?.({ error: "You are already in a room." });
      return;
    }

    removeFromRandomQueue(socket.id);
    const opponentSocket = popActiveOpponent(socket.id);

    if (!opponentSocket) {
      randomQueue.push(socket.id);
      cb?.({ queued: true, message: "Waiting for an opponent..." });
      return;
    }

    const roomId = `random-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const first = Math.random() < 0.5 ? socket : opponentSocket;
    const second = first === socket ? opponentSocket : socket;

    let firstResult = {};
    let secondResult = {};
    joinRoom(first, { roomId }, (res) => {
      firstResult = res || {};
    }, true);
    joinRoom(second, { roomId }, (res) => {
      secondResult = res || {};
    }, false);

    if (firstResult.error || secondResult.error) {
      const errMessage = firstResult.error || secondResult.error || "Failed to create match.";
      cb?.({ error: errMessage });
      opponentSocket.emit("random_match_failed", { error: errMessage });
      return;
    }

    const payloadForCurrent = socket.id === first.id ? firstResult : secondResult;
    const payloadForOpponent = socket.id === first.id ? secondResult : firstResult;

    cb?.({ ...payloadForCurrent, roomId });
    opponentSocket.emit("random_match_found", { ...payloadForOpponent, roomId });
  });

  socket.on("cancel_random", () => {
    removeFromRandomQueue(socket.id);
  });

  socket.on("move", ({ roomId, fen }, cb) => {
    const room = rooms.get(roomId);
    if (!room) {
      cb?.({ error: "Room not found." });
      return;
    }
    room.fen = fen;
    socket.to(roomId).emit("move", { fen });
    cb?.({ ok: true });
  });

  socket.on("leave_room", () => {
    removeFromRandomQueue(socket.id);
    const roomId = socketRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    socketRooms.delete(socket.id);
    socket.leave(roomId);
    socket.to(roomId).emit("opponent_left");
    if (room.players.length === 0) {
      rooms.delete(roomId);
    }
  });

  socket.on("disconnect", () => {
    removeFromRandomQueue(socket.id);
    const roomId = socketRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.players = room.players.filter((p) => p.socketId !== socket.id);
        socket.to(roomId).emit("opponent_left");
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
      socketRooms.delete(socket.id);
    }
    connectedUsers.delete(socket.id);
    broadcastUserList();
  });
});

module.exports = { app, server };
