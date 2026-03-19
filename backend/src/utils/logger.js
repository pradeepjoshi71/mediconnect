const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  defaultMeta: {
    service: "mediconnect-backend",
    environment: process.env.NODE_ENV || "development",
  },
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format((info) => {
      if (info.message instanceof Error) {
        info.error = info.message.message;
        info.message = info.message.message;
      }
      return info;
    })(),
    format.json()
  ),
  transports: [new transports.Console()],
});

module.exports = {
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  http: (message, meta) => logger.http(message, meta),
};
