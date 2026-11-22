// ---------------------------------------------------------------------------
// Authenticated WebSocket server — streams simulated EEG data
// ---------------------------------------------------------------------------
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { URL } from "url";
import { EEGSimulator } from "./simulator.js";

const SEND_INTERVAL_MS = 100; // 25 samples every 100 ms = 250 Hz
const SAMPLES_PER_TICK = 25;

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Path: /ws?token=<JWT access token>
 */
export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // ── Upgrade handshake — authenticate before accepting ──────────────────
  httpServer.on("upgrade", (req, socket, head) => {
    // Only handle /ws path
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = payload;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  // ── Connection handler ─────────────────────────────────────────────────
  wss.on("connection", (ws, req) => {
    const user = req.user;
    console.log(`⚡ WS connected: ${user.email} (id ${user.sub})`);

    const sim = new EEGSimulator();

    // Stream EEG data at 250 Hz (25 samples every 100 ms)
    const timer = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        const data = sim.generate(SAMPLES_PER_TICK);
        ws.send(JSON.stringify(data));
      }
    }, SEND_INTERVAL_MS);

    // ── Incoming messages from client ────────────────────────────────────
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);

        switch (msg.type) {
          case "state":
            if (["focus", "relax", "closed"].includes(msg.value)) {
              sim.setState(msg.value);
              console.log(`   ${user.email} → state: ${msg.value}`);
            }
            break;

          case "blink":
            sim.blink();
            break;

          default:
            ws.send(JSON.stringify({ error: `Unknown message type: ${msg.type}` }));
        }
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    // ── Clean up on disconnect ───────────────────────────────────────────
    ws.on("close", () => {
      clearInterval(timer);
      console.log(`⚡ WS disconnected: ${user.email}`);
    });

    ws.on("error", () => {
      clearInterval(timer);
    });

    // Send initial confirmation
    ws.send(
      JSON.stringify({
        type: "connected",
        user: { id: user.sub, email: user.email },
        channels: ["Fp1", "Cz", "O1"],
        sampleRate: 250,
      })
    );
  });

  return wss;
}
