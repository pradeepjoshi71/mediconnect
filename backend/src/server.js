const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { setIO, attachSocketHandlers } = require("./realtime/io");
const logger = require("./utils/logger");
const backupScheduler = require("./services/backupScheduler");

const PORT = process.env.PORT || 5000;

// PM2 cluster instance index (0-based). Only instance 0 runs background jobs.
const INSTANCE_ID = parseInt(process.env.NODE_APP_INSTANCE || "0", 10);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Setup Redis adapter for Socket.io cross-worker signaling in PM2 cluster mode
if (process.env.REDIS_ENABLED !== "false" && process.env.NODE_ENV !== "test") {
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const Redis = require("ioredis");
    const redisOptions = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          db: Number(process.env.REDIS_DB || 0),
        };
    const pubClient = typeof redisOptions === "string" ? new Redis(redisOptions) : new Redis(redisOptions);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io: Redis adapter attached for cross-process WebRTC signaling");
  } catch (err) {
    logger.warn("Socket.io: Failed to initialize Redis adapter, falling back to in-memory adapter", { error: err.message });
  }
} else {
  logger.warn("Socket.io: REDIS_ENABLED=false or test mode — falling back to in-memory adapter");
}

io.on("connection", (socket) => {
  attachSocketHandlers(socket);
});

setIO(io);

server.listen(PORT, () => {
  logger.info("Server started", { port: PORT, instanceId: INSTANCE_ID });
});

// ─── Graceful shutdown (PM2 / Docker SIGTERM) ─────────────────────────────────
function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully`, { instanceId: INSTANCE_ID });

  // Stop backup scheduler timers only on the instance that owns them
  if (INSTANCE_ID === 0) {
    backupScheduler.stop();
  }

  server.close((err) => {
    if (err) {
      logger.error("Error during server close", { error: err.message });
      process.exit(1);
    }
    logger.info("Server closed cleanly");
    process.exit(0);
  });

  // Force-kill if graceful close exceeds 15 seconds
  setTimeout(() => {
    logger.error("Shutdown timeout exceeded — force killing");
    process.exit(1);
  }, 15_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require("@sentry/node");
      Sentry.captureException(reason);
    } catch (_) {}
  }
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require("@sentry/node");
      Sentry.captureException(error);
    } catch (_) {}
  }
  process.exit(1);
});
