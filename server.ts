import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET || "baat-secret-token-key-fallback";

let pool: Pool | null = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 4000,
    });
  } catch (err) {
    console.warn("Failed to initialize PostgreSQL pool:", err);
  }
}

interface MemUser {
  id: string;
  chatId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  bio: string;
  status: string;
  avatarUrl: string | null;
  accent: string;
}

interface MemChat {
  id: string;
  updatedAt: string;
  members: string[];
}

interface MemMessage {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

const memoryUsers = new Map<string, MemUser>();
const memoryChats = new Map<string, MemChat>();
const memoryMessages = new Map<string, MemMessage[]>();

// Seed default in-memory demo user
const seedDemoUser = async () => {
  const hash = await bcrypt.hash("password123", 10);
  const demo: MemUser = {
    id: "user-anshbro",
    chatId: "BAAT-48291",
    username: "anshbro",
    passwordHash: hash,
    displayName: "Ansh Bro",
    bio: "Here when it matters.",
    status: "Available",
    avatarUrl: null,
    accent: "#9bf6ff",
  };
  memoryUsers.set(demo.id, demo);
};
void seedDemoUser();

const clients = new Map<string, Set<WebSocket>>();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, "backend", "schema.sql");

type Identity = { id: string; chatId: string };
type AuthRequest = Request & { user?: Identity };

app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));

const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Missing token" });
    req.user = jwt.verify(token, jwtSecret) as Identity;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
};

const sendTo = (userId: string, event: unknown) => {
  clients.get(userId)?.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event));
      } catch {
        // Socket send error ignored
      }
    }
  });
};

const createChatId = async () => {
  for (let i = 0; i < 50; i++) {
    const id = `BAAT-${Math.floor(10000 + Math.random() * 90000)}`;
    if (pool && dbAvailable) {
      try {
        const result = await pool.query("SELECT 1 FROM users WHERE chat_id = $1", [id]);
        if (!result.rowCount) return id;
      } catch {
        return id;
      }
    } else {
      let taken = false;
      for (const u of memoryUsers.values()) {
        if (u.chatId === id) {
          taken = true;
          break;
        }
      }
      if (!taken) return id;
    }
  }
  return `BAAT-${Math.floor(10000 + Math.random() * 90000)}`;
};

const safeUser = (row: Record<string, unknown>) => ({
  id: row.id,
  chatId: row.chat_id,
  username: row.username,
  displayName: row.display_name ?? row.username,
  bio: row.bio ?? "",
  status: row.status ?? "Available",
  avatarUrl: row.avatar_url ?? null,
  accent: row.accent ?? "#9bf6ff",
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "baat",
    db: dbAvailable ? "postgres" : "in-memory",
  });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = z
    .object({
      username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
      password: z.string().min(8).max(128),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Username or password is invalid" });
  }

  try {
    const chatId = await createChatId();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    if (pool && dbAvailable) {
      const result = await pool.query(
        "INSERT INTO users(chat_id, username, password_hash) VALUES($1, $2, $3) RETURNING id, chat_id, username",
        [chatId, parsed.data.username, passwordHash],
      );
      await pool.query("INSERT INTO profiles(user_id, display_name) VALUES($1, $2)", [
        result.rows[0].id,
        parsed.data.username,
      ]);

      const token = jwt.sign({ id: result.rows[0].id, chatId }, jwtSecret, { expiresIn: "30d" });
      return res.status(201).json({
        token,
        user: { ...result.rows[0], chatId, displayName: parsed.data.username },
      });
    } else {
      for (const u of memoryUsers.values()) {
        if (u.username.toLowerCase() === parsed.data.username.toLowerCase()) {
          return res.status(409).json({ error: "Username already taken" });
        }
      }

      const id = `user-${Date.now()}`;
      const newUser: MemUser = {
        id,
        chatId,
        username: parsed.data.username,
        passwordHash,
        displayName: parsed.data.username,
        bio: "",
        status: "Available",
        avatarUrl: null,
        accent: "#9bf6ff",
      };
      memoryUsers.set(id, newUser);

      const token = jwt.sign({ id, chatId }, jwtSecret, { expiresIn: "30d" });
      return res.status(201).json({
        token,
        user: {
          id: newUser.id,
          chatId: newUser.chatId,
          username: newUser.username,
          displayName: newUser.displayName,
          bio: newUser.bio,
          status: newUser.status,
          avatarUrl: newUser.avatarUrl,
          accent: newUser.accent,
        },
      });
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res.status(code === "23505" ? 409 : 500).json({
      error: code === "23505" ? "Username already taken" : "Could not create account",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = z
    .object({ chatId: z.string().trim().toUpperCase(), password: z.string() })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  try {
    if (pool && dbAvailable) {
      const result = await pool.query(
        "SELECT u.*, p.* FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.chat_id = $1",
        [parsed.data.chatId],
      );

      if (!result.rowCount) {
        return res.status(401).json({ error: "Invalid Chat ID or password" });
      }

      const user = result.rows[0];
      const match = await bcrypt.compare(parsed.data.password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid Chat ID or password" });
      }

      return res.json({
        token: jwt.sign({ id: user.id, chatId: user.chat_id }, jwtSecret, { expiresIn: "30d" }),
        user: safeUser(user),
      });
    } else {
      let found: MemUser | undefined;
      for (const u of memoryUsers.values()) {
        if (u.chatId === parsed.data.chatId) {
          found = u;
          break;
        }
      }

      if (!found) {
        return res.status(401).json({ error: "Invalid Chat ID or password" });
      }

      const match = await bcrypt.compare(parsed.data.password, found.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid Chat ID or password" });
      }

      return res.json({
        token: jwt.sign({ id: found.id, chatId: found.chatId }, jwtSecret, { expiresIn: "30d" }),
        user: {
          id: found.id,
          chatId: found.chatId,
          username: found.username,
          displayName: found.displayName,
          bio: found.bio,
          status: found.status,
          avatarUrl: found.avatarUrl,
          accent: found.accent,
        },
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
});

app.post("/api/auth/logout", auth, (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/users/search", auth, async (req: AuthRequest, res) => {
  const query = String(req.query.q ?? "").trim().slice(0, 32);

  try {
    if (pool && dbAvailable) {
      const result = await pool.query(
        "SELECT u.*, p.* FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.chat_id ILIKE $1 OR u.username ILIKE $1 OR p.display_name ILIKE $1 LIMIT 20",
        [`%${query}%`],
      );
      return res.json({ users: result.rows.filter((row) => row.id !== req.user!.id).map(safeUser) });
    } else {
      const q = query.toLowerCase();
      const results: MemUser[] = [];
      for (const u of memoryUsers.values()) {
        if (u.id === req.user!.id) continue;
        if (
          u.chatId.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q)
        ) {
          results.push(u);
        }
      }
      return res.json({
        users: results.map((u) => ({
          id: u.id,
          chatId: u.chatId,
          username: u.username,
          displayName: u.displayName,
          bio: u.bio,
          status: u.status,
          avatarUrl: u.avatarUrl,
          accent: u.accent,
        })),
      });
    }
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/chats", auth, async (req: AuthRequest, res) => {
  try {
    if (pool && dbAvailable) {
      const result = await pool.query(
        `SELECT c.id, c.updated_at, u.chat_id, u.username, p.display_name, p.avatar_url, p.accent 
         FROM chats c 
         JOIN chat_members own ON own.chat_id = c.id AND own.user_id = $1 
         JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $1 
         JOIN users u ON u.id = other.user_id 
         LEFT JOIN profiles p ON p.user_id = u.id 
         ORDER BY c.updated_at DESC`,
        [req.user!.id],
      );
      return res.json({
        chats: result.rows.map((row) => ({
          id: row.id,
          chatId: row.chat_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          accent: row.accent,
          updatedAt: row.updated_at,
        })),
      });
    } else {
      const userChats: Array<{
        id: string;
        chatId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        accent: string;
        updatedAt: string;
      }> = [];

      for (const chat of memoryChats.values()) {
        if (chat.members.includes(req.user!.id)) {
          const otherId = chat.members.find((m) => m !== req.user!.id);
          const otherUser = otherId ? memoryUsers.get(otherId) : null;
          if (otherUser) {
            userChats.push({
              id: chat.id,
              chatId: otherUser.chatId,
              username: otherUser.username,
              displayName: otherUser.displayName,
              avatarUrl: otherUser.avatarUrl,
              accent: otherUser.accent,
              updatedAt: chat.updatedAt,
            });
          }
        }
      }

      return res.json({ chats: userChats });
    }
  } catch (error) {
    console.error("Get chats error:", error);
    return res.status(500).json({ error: "Could not retrieve chats" });
  }
});

app.post("/api/chats", auth, async (req: AuthRequest, res) => {
  const targetChatId = String(req.body.chatId ?? "").toUpperCase();

  try {
    if (pool && dbAvailable) {
      const target = await pool.query("SELECT id FROM users WHERE chat_id = $1", [targetChatId]);
      if (!target.rowCount) {
        return res.status(404).json({ error: "User not found" });
      }

      const existing = await pool.query(
        "SELECT c.id FROM chats c JOIN chat_members a ON a.chat_id = c.id AND a.user_id = $1 JOIN chat_members b ON b.chat_id = c.id AND b.user_id = $2",
        [req.user!.id, target.rows[0].id],
      );

      if (existing.rowCount) {
        return res.json({ id: existing.rows[0].id });
      }

      const chat = await pool.query("INSERT INTO chats DEFAULT VALUES RETURNING id");
      await pool.query("INSERT INTO chat_members(chat_id, user_id) VALUES($1, $2), ($1, $3)", [
        chat.rows[0].id,
        req.user!.id,
        target.rows[0].id,
      ]);
      return res.status(201).json({ id: chat.rows[0].id });
    } else {
      let targetUser: MemUser | undefined;
      for (const u of memoryUsers.values()) {
        if (u.chatId === targetChatId) {
          targetUser = u;
          break;
        }
      }

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      for (const chat of memoryChats.values()) {
        if (chat.members.includes(req.user!.id) && chat.members.includes(targetUser.id)) {
          return res.json({ id: chat.id });
        }
      }

      const newChatId = `chat-${Date.now()}`;
      const newChat: MemChat = {
        id: newChatId,
        updatedAt: new Date().toISOString(),
        members: [req.user!.id, targetUser.id],
      };
      memoryChats.set(newChatId, newChat);
      return res.status(201).json({ id: newChatId });
    }
  } catch (error) {
    console.error("Create chat error:", error);
    return res.status(500).json({ error: "Could not create chat" });
  }
});

app.get("/api/chats/:id/messages", auth, async (req: AuthRequest, res) => {
  const chatId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);

  try {
    if (pool && dbAvailable) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
      if (!isUuid) {
        return res.json({ messages: [] });
      }

      const member = await pool.query(
        "SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2",
        [chatId, req.user!.id],
      );
      if (!member.rowCount) {
        return res.status(403).json({ error: "Not a chat member" });
      }

      const messages = await pool.query(
        "SELECT id, body, sender_id, created_at, read_at FROM messages WHERE chat_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 200",
        [chatId],
      );

      return res.json({
        messages: messages.rows.map((message) => ({
          id: message.id,
          body: message.body,
          mine: message.sender_id === req.user!.id,
          time: message.created_at,
          read: Boolean(message.read_at),
        })),
      });
    } else {
      const chat = memoryChats.get(chatId);
      if (chat && !chat.members.includes(req.user!.id)) {
        return res.status(403).json({ error: "Not a chat member" });
      }

      const list = memoryMessages.get(chatId) ?? [];
      return res.json({
        messages: list.map((m) => ({
          id: m.id,
          body: m.body,
          mine: m.senderId === req.user!.id,
          time: m.createdAt,
          read: Boolean(m.readAt),
        })),
      });
    }
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ error: "Could not retrieve messages" });
  }
});

app.post("/api/chats/:id/messages", auth, async (req: AuthRequest, res) => {
  const chatId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
  const body = z.string().trim().min(1).max(4000).safeParse(req.body.body);

  if (!body.success) {
    return res.status(400).json({ error: "Message is invalid" });
  }

  try {
    if (pool && dbAvailable) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
      if (!isUuid) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const member = await pool.query("SELECT user_id FROM chat_members WHERE chat_id = $1", [chatId]);
      if (!member.rows.some((row) => row.user_id === req.user!.id)) {
        return res.status(403).json({ error: "Not a chat member" });
      }

      const message = await pool.query(
        "INSERT INTO messages(chat_id, sender_id, body) VALUES($1, $2, $3) RETURNING id, body, created_at",
        [chatId, req.user!.id, body.data],
      );

      await pool.query("UPDATE chats SET updated_at = now() WHERE id = $1", [chatId]);

      member.rows.forEach((row) => {
        const memberEvent = {
          type: "message.created",
          chatId,
          message: {
            id: message.rows[0].id,
            body: message.rows[0].body,
            time: message.rows[0].created_at,
            mine: row.user_id === req.user!.id,
          },
        };
        sendTo(row.user_id, memberEvent);
      });

      return res.status(201).json({
        id: message.rows[0].id,
        body: message.rows[0].body,
        time: message.rows[0].created_at,
        mine: true,
      });
    } else {
      const chat = memoryChats.get(chatId);
      const members = chat ? chat.members : [req.user!.id];

      const newMsgId = `msg-${Date.now()}`;
      const now = new Date().toISOString();
      const newMsg: MemMessage = {
        id: newMsgId,
        chatId,
        senderId: req.user!.id,
        body: body.data,
        createdAt: now,
        readAt: null,
      };

      const list = memoryMessages.get(chatId) ?? [];
      list.push(newMsg);
      memoryMessages.set(chatId, list);

      if (chat) {
        chat.updatedAt = now;
      }

      members.forEach((uid) => {
        const memberEvent = {
          type: "message.created",
          chatId,
          message: {
            id: newMsg.id,
            body: newMsg.body,
            time: newMsg.createdAt,
            mine: uid === req.user!.id,
          },
        };
        sendTo(uid, memberEvent);
      });

      return res.status(201).json({
        id: newMsg.id,
        body: newMsg.body,
        time: newMsg.createdAt,
        mine: true,
      });
    }
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ error: "Could not send message" });
  }
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket, request) => {
  try {
    const token = new URL(request.url ?? "", "http://localhost").searchParams.get("token");
    const identity = jwt.verify(token ?? "", jwtSecret) as Identity;
    const connections = clients.get(identity.id) ?? new Set<WebSocket>();
    connections.add(socket);
    clients.set(identity.id, connections);

    socket.on("close", () => {
      connections.delete(socket);
      if (!connections.size) clients.delete(identity.id);
    });
  } catch {
    socket.close(1008, "Unauthorized");
  }
});

async function start() {
  if (pool) {
    try {
      const client = await pool.connect();
      console.log("Connected to PostgreSQL database");
      dbAvailable = true;

      if (fs.existsSync(schemaPath)) {
        const schemaSql = await fs.promises.readFile(schemaPath, "utf8");
        await client.query(schemaSql);
        console.log("Database schema initialized");
      }
      client.release();
    } catch (err) {
      console.warn("PostgreSQL not accessible, using in-memory store:", err);
      dbAvailable = false;
    }
  } else {
    console.log("DATABASE_URL not set; running with in-memory database store.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/ws") {
          return next();
        }
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Baat server listening on http://0.0.0.0:${port}`);
  });
}

start().catch((error) => {
  console.error("Fatal startup error:", error);
});
