import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface User {
  id: string;
  phone_number: string;
  password: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

let db: DatabaseType | null = null;

function getDb(): DatabaseType {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'app.db');
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  return db;
}

// User operations
export const userOperations = {
  create(id: string, phoneNumber: string, password: string, name: string | null) {
    return getDb().prepare(`
      INSERT INTO users (id, phone_number, password, name)
      VALUES (?, ?, ?, ?)
    `).run(id, phoneNumber, password, name);
  },

  findByPhone(phoneNumber: string): User | undefined {
    return getDb().prepare<[string], User>(`
      SELECT * FROM users WHERE phone_number = ?
    `).get(phoneNumber);
  },

  findById(id: string): User | undefined {
    return getDb().prepare<[string], User>(`
      SELECT * FROM users WHERE id = ?
    `).get(id);
  },

  updateName(id: string, name: string) {
    return getDb().prepare(`
      UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?
    `).run(name, id);
  },
};

// Session operations
export const sessionOperations = {
  create(id: string, userId: string, token: string, expiresAt: string) {
    return getDb().prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, token, expiresAt);
  },

  findByToken(token: string): Session | undefined {
    return getDb().prepare<[string], Session>(`
      SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')
    `).get(token);
  },

  deleteByToken(token: string) {
    return getDb().prepare(`
      DELETE FROM sessions WHERE token = ?
    `).run(token);
  },

  deleteByUserId(userId: string) {
    return getDb().prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).run(userId);
  },

  deleteExpired() {
    return getDb().prepare(`
      DELETE FROM sessions WHERE expires_at <= datetime('now')
    `).run();
  },
};

export default getDb;
