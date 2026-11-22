// ---------------------------------------------------------------------------
// Express app factory — separated from listen() so Supertest can import it
// ---------------------------------------------------------------------------
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// ── Global middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ── Rate limiters (skip in test) ────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    name: "EEG Dashboard API",
    version: "1.0.0",
    endpoints: {
      health: "GET  /api/health",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      refresh: "POST /api/auth/refresh",
      logout: "POST /api/auth/logout",
      me: "GET  /api/auth/me",
      changePassword: "POST /api/auth/change-password",
      adminUsers: "GET  /api/admin/users",
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// ── Error handler ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
