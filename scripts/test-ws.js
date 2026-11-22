// ---------------------------------------------------------------------------
// Test script: log in → connect to /ws with token → print EEG chunks
// ---------------------------------------------------------------------------
// Usage:  node scripts/test-ws.js
// ---------------------------------------------------------------------------
const BASE = "http://localhost:4000";
const WS_BASE = "ws://localhost:4000";

const USER = {
  name: "WS Tester",
  email: "ws-test@example.com",
  password: "testpass123",
  consent: true,
};

async function main() {
  // ── 1. Register (ignore 409 if already exists) ─────────────────────────
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(USER),
  });

  // ── 2. Login ───────────────────────────────────────────────────────────
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: USER.email, password: USER.password }),
  });
  const { token } = await loginRes.json();
  console.log("✅ Logged in, token:", token.slice(0, 20) + "…\n");

  // ── 3. Connect to WebSocket with token ─────────────────────────────────
  const { default: WebSocket } = await import("ws");
  const ws = new WebSocket(`${WS_BASE}/ws?token=${token}`);

  let chunks = 0;

  ws.on("open", () => console.log("⚡ WebSocket connected\n"));

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);

    if (msg.type === "connected") {
      console.log("Server says:", msg);
      console.log(`\nStreaming ${msg.channels.join(", ")} at ${msg.sampleRate} Hz…\n`);

      // After 500 ms, switch to "focus" state
      setTimeout(() => {
        console.log('→ Sending state: "focus"');
        ws.send(JSON.stringify({ type: "state", value: "focus" }));
      }, 500);

      // After 800 ms, trigger a blink
      setTimeout(() => {
        console.log("→ Sending blink\n");
        ws.send(JSON.stringify({ type: "blink" }));
      }, 800);

      return;
    }

    // Print first 5 data chunks
    chunks++;
    if (chunks <= 5) {
      const preview = msg.samples.map(
        (ch, i) => `  ${msg.channels[i]}: [${ch.slice(0, 3).join(", ")}, … ] (${ch.length} samples)`
      );
      console.log(`Chunk #${chunks}:`);
      console.log(preview.join("\n"));
      console.log();
    }

    if (chunks === 5) {
      console.log("✅ Received 5 chunks — closing connection.\n");
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log("⚡ WebSocket closed.");
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
    process.exit(1);
  });
}

main().catch(console.error);
