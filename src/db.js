// ---------------------------------------------------------------------------
// SQLite database (better-sqlite3) — synchronous, single-file, zero-config
// ---------------------------------------------------------------------------
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow overriding the DB path for tests (in-memory or temp file)
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "eeg.db");

// Ensure the data/ folder exists (skip for :memory:)
if (DB_PATH !== ":memory:") {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

// Performance / safety pragmas
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    consent_at    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  TEXT    NOT NULL,
    revoked     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
