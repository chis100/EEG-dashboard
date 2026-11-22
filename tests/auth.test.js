// ---------------------------------------------------------------------------
// Auth integration tests — Vitest + Supertest
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

// ── Bootstrap: set env vars BEFORE any app code is imported ─────────────────
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_ACCESS_SECRET = "test-secret-key-for-vitest";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.NODE_ENV = "test";

// Dynamic import so env vars are set first
const { default: app } = await import("../src/app.js");
const { default: db } = await import("../src/db.js");

// ── Helpers ─────────────────────────────────────────────────────────────────
const ALICE = {
  name: "Alice",
  email: "alice@example.com",
  password: "secret1234",
  consent: true,
};

function extractCookies(res) {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

function getRefreshCookie(res) {
  const raw = res.headers["set-cookie"] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const match = arr.find((c) => c.startsWith("refresh_token="));
  return match ? match.split(";")[0].split("=").slice(1).join("=") : null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("creates a new user", async () => {
    const res = await request(app).post("/api/auth/register").send(ALICE);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
      role: "user",
    });
    expect(res.body.id).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send(ALICE);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...ALICE, email: "short@e.com", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("rejects missing consent", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...ALICE, email: "no-consent@e.com", consent: false });
    expect(res.status).toBe(400);
    expect(res.body.errors.consent).toBeDefined();
  });
});

describe("POST /api/auth/login", () => {
  it("returns access token and sets refresh cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(ALICE.email);

    // Check httpOnly refresh cookie
    const cookie = getRefreshCookie(res);
    expect(cookie).toBeTruthy();
  });

  it("rejects wrong password with generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects unknown email with same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("POST /api/auth/refresh", () => {
  let refreshCookies;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });

    refreshCookies = extractCookies(res);
  });

  it("issues a new access token and rotates the refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookies);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    // A new refresh cookie should be set (rotation)
    const newCookie = getRefreshCookie(res);
    expect(newCookie).toBeTruthy();
  });

  it("rejects when old (rotated) cookie is reused", async () => {
    // The cookie from beforeAll was already consumed above
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookies);

    expect(res.status).toBe(401);
  });

  it("rejects when no cookie is sent", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token and clears the cookie", async () => {
    // Login first to get a valid cookie
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });

    const cookies = extractCookies(login);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");

    // Trying to refresh with the same cookie should now fail
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);

    expect(refresh.status).toBe(401);
  });
});

describe("GET /api/auth/me (protected)", () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });
    accessToken = res.body.token;
  });

  it("returns user profile with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ALICE.email);
    expect(res.body.name).toBe(ALICE.name);
  });

  it("rejects request without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or malformed token");
  });

  it("rejects request with invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });
});

describe("POST /api/auth/change-password", () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });
    accessToken = res.body.token;
  });

  it("changes the password and revokes refresh tokens", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: ALICE.password, newPassword: "new-secret-999" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password changed");

    // Can log in with the new password
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: "new-secret-999" });
    expect(login.status).toBe(200);

    // Old password no longer works
    const old = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });
    expect(old.status).toBe(401);

    // Restore original password for later tests
    const tok = login.body.token;
    await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${tok}`)
      .send({ currentPassword: "new-secret-999", newPassword: ALICE.password });
  });

  it("rejects wrong current password", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ currentPassword: "wrong-password", newPassword: "anything123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Current password is incorrect");
  });
});

describe("GET /api/admin/users (admin-only)", () => {
  let userToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });
    userToken = res.body.token;
  });

  it("rejects normal user", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("allows admin user", async () => {
    // Promote Alice to admin directly in the DB
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(ALICE.email);

    // Need a fresh token with the updated role
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Restore role
    db.prepare("UPDATE users SET role = 'user' WHERE email = ?").run(ALICE.email);
  });
});
