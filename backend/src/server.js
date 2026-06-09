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
