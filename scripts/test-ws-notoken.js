// ---------------------------------------------------------------------------
// Test script: try connecting WITHOUT a token — should be rejected
// ---------------------------------------------------------------------------
// Usage:  node scripts/test-ws-notoken.js
// ---------------------------------------------------------------------------

async function main() {
  const { default: WebSocket } = await import("ws");

  console.log("Attempting connection WITHOUT a token…\n");

  const ws = new WebSocket("ws://localhost:4000/ws");

  ws.on("open", () => {
    console.log("❌ Unexpected: connection was accepted without a token!");
    ws.close();
    process.exit(1);
  });

  ws.on("error", (err) => {
    console.log("✅ Connection correctly rejected!");
    console.log("   Error:", err.message);
    process.exit(0);
  });

  // Timeout safety
  setTimeout(() => {
    console.log("❌ Timed out — no response from server.");
    process.exit(1);
  }, 5000);
}

main().catch(console.error);
