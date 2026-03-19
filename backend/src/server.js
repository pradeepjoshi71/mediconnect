const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { setIO, attachSocketHandlers } = require("./realtime/io");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  attachSocketHandlers(socket);
});

setIO(io);

server.listen(PORT, () => {
  logger.info("Server started", { port: PORT });
});
