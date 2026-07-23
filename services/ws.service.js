const { WebSocketServer } = require("ws");

function attachWebSocket(server, port) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const userId = url.searchParams.get("userId") || "anonymous";

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    ws.on("close", () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) {
        clients.delete(userId);
      }
    });
  });

  function sendToUser(userId, event) {
    const payload = JSON.stringify(event);
    const sockets = clients.get(userId);
    if (!sockets) return;

    for (const ws of sockets) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  return { sendToUser };
}

module.exports = { attachWebSocket };
