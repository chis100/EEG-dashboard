// ---------------------------------------------------------------------------
// Server entry-point — HTTP + WebSocket
// ---------------------------------------------------------------------------
import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { attachWebSocket } from "./ws.js";

const PORT = process.env.PORT || 4000;

// Create a raw HTTP server so we can share it with WebSocket
const httpServer = createServer(app);

// Attach authenticated WebSocket on /ws
attachWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🧠 EEG backend listening on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket available at  ws://localhost:${PORT}/ws?token=<JWT>`);
});
