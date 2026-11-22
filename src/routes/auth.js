// ---------------------------------------------------------------------------
// Auth routes — register · login · refresh · logout · change-password · me
// ---------------------------------------------------------------------------
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "../token.js";

const router = Router();
const SALT_ROUNDS = 12;
const REFRESH_COOKIE = "refresh_token";

// ── Cookie helper ──────────────────────────────────────────────────────────
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

// ── Validation schemas ─────────────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = db.prepare("SELECT 1 FROM users WHERE email = ?").get(data.email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, consent_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .run(data.name, data.email, passwordHash);

    return res.status(201).json({
      id: info.lastInsertRowid,
      name: data.name,
      email: data.email,
      role: "user",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.flatten().fieldErrors });
    }
    next(err);
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const GENERIC = "Invalid email or password";

    const user = db
      .prepare("SELECT id, name, email, role, password_hash FROM users WHERE email = ?")
      .get(data.email);

    if (!user) {
      return res.status(401).json({ error: GENERIC });
    }

    const match = await bcrypt.compare(data.password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: GENERIC });
    }

    // Access token
    const accessToken = issueAccessToken(user);

    // Refresh token → httpOnly cookie
    const refreshToken = generateRefreshToken();
    storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    return res.json({
      token: accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.flatten().fieldErrors });
    }
    next(err);
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post("/refresh", (req, res) => {
  const oldPlain = req.cookies?.[REFRESH_COOKIE];

  if (!oldPlain) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const row = verifyRefreshToken(oldPlain);
  if (!row) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Revoke old token (rotation)
  revokeRefreshToken(row.id);

  // Issue new pair
  const user = db
    .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
    .get(row.user_id);

  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "User not found" });
  }

  const accessToken = issueAccessToken(user);
  const newRefresh = generateRefreshToken();
  storeRefreshToken(user.id, newRefresh);
  setRefreshCookie(res, newRefresh);

  return res.json({ token: accessToken });
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  const plain = req.cookies?.[REFRESH_COOKIE];

  if (plain) {
    const row = verifyRefreshToken(plain);
    if (row) revokeRefreshToken(row.id);
  }

  clearRefreshCookie(res);
  return res.json({ message: "Logged out" });
});

// ── POST /api/auth/change-password ──────────────────────────────────────────
router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(req.user.sub);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

    // Revoke all refresh tokens so other sessions are forced to re-login
    revokeAllUserTokens(user.id);
    clearRefreshCookie(res);

    return res.json({ message: "Password changed" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.flatten().fieldErrors });
    }
    next(err);
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?")
    .get(req.user.sub);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

export default router;
