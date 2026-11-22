// ---------------------------------------------------------------------------
// Refresh-token helpers — generate, hash, store, verify, revoke
// ---------------------------------------------------------------------------
import crypto from "crypto";
import db from "./db.js";

const REFRESH_TOKEN_BYTES = 48; // 64-char hex string
const REFRESH_TOKEN_DAYS = 7;

/** Generate a cryptographically random refresh token (plain text). */
export function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

/** SHA-256 hash of a plain token (this is what we store). */
export function hashToken(plainToken) {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}

/** Persist a hashed refresh token for a user. Returns the row id. */
export function storeRefreshToken(userId, plainToken) {
  const hash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000).toISOString();

  const info = db
    .prepare(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    )
    .run(userId, hash, expiresAt);

  return info.lastInsertRowid;
}

/**
 * Validate a plain refresh token. Returns the matching row (with user_id) or
 * null if the token is invalid, expired, or already revoked.
 */
export function verifyRefreshToken(plainToken) {
  const hash = hashToken(plainToken);

  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, revoked
       FROM refresh_tokens
       WHERE token_hash = ?`
    )
    .get(hash);

  if (!row) return null;
  if (row.revoked) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return row;
}

/** Revoke a single refresh token by its id. */
export function revokeRefreshToken(id) {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?").run(id);
}

/** Revoke ALL refresh tokens for a user (e.g. on password change). */
export function revokeAllUserTokens(userId) {
  db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0").run(userId);
}
