// ---------------------------------------------------------------------------
// Auth middleware — JWT verification & role gate
// ---------------------------------------------------------------------------
import jwt from "jsonwebtoken";

/**
 * Require a valid JWT access token in the Authorization header.
 * Attaches the decoded payload to req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { sub, email, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Factory: require the authenticated user to have a specific role.
 * Must be used AFTER requireAuth so req.user exists.
 *
 * Usage: router.get("/admin-thing", requireAuth, requireRole("admin"), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
