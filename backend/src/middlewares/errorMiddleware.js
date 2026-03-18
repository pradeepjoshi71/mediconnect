const { ZodError } = require("zod");
const { MulterError } = require("multer");
const { AppError } = require("../utils/http");
const logger = require("../utils/logger");

function notFoundMiddleware(req, res) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
}

function errorMiddleware(error, req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: error.issues,
      requestId: req.requestId,
    });
  }

  if (error instanceof MulterError) {
    return res.status(400).json({
      message: error.message,
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
      requestId: req.requestId,
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      message: "A record with the same unique value already exists",
      requestId: req.requestId,
    });
  }

  logger.error("Unhandled request error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: error?.message,
  });

  return res.status(500).json({
    message: "Internal server error",
    requestId: req.requestId,
  });
}

module.exports = { errorMiddleware, notFoundMiddleware };
