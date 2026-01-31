import "dotenv/config";
import next from "next";
import { createServer } from "http";
import { initializeSocket } from "./lib/socket/server.js";

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const dev = false;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

// Create server WITHOUT handler first
const server = createServer();

// 1) Attach Socket.IO FIRST (must get request listener priority)
initializeSocket(server);

// 2) Then pass all HTTP requests to Next
server.on("request", (req, res) => handle(req, res));

server.listen(port, hostname, () => {
  console.log(`[server] Ready on http://${hostname}:${port}`);
  console.log(`[socket] Listening on path /api/socket`);
});
