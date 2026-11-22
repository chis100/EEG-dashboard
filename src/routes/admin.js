// ---------------------------------------------------------------------------
// Admin routes — user management
// ---------------------------------------------------------------------------
import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole("admin"));

// ── GET /api/admin/users ────────────────────────────────────────────────────
router.get("/users", (_req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, consent_at, created_at FROM users ORDER BY id")
    .all();

  return res.json(users);
});

export default router;
