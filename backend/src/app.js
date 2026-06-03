const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const db = require("./config/db");
const { pingRedis } = require("./config/redis");

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const medicalRecordRoutes = require("./routes/medicalRecordRoutes");
const fileRoutes = require("./routes/fileRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const recordRoutes = require("./routes/recordRoutes");
const documentRoutes = require("./routes/documentRoutes");
const telemedicineRoutes = require("./routes/telemedicineRoutes");
const intelligenceRoutes = require("./routes/intelligenceRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const { requestContext } = require("./middlewares/requestContext");
const { errorMiddleware, notFoundMiddleware } = require("./middlewares/errorMiddleware");
const logger = require("./utils/logger");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./utils/swagger");

function buildCorsOptions() {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  };
}

const app = express();

app.set("trust proxy", 1);
app.use(requestContext);
app.use(cors(buildCorsOptions()));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);
app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.API_RATE_LIMIT || 120),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "backend", message: "MediConnect API is running" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/api/v1/health/ready", async (_req, res) => {
  let database = { status: "error" };
  try {
    await db.query("SELECT 1");
    database = { status: "ready" };
  } catch (error) {
    database = { status: "error", error: error.message };
  }

  const redis = await pingRedis();
  const ready = database.status === "ready" && ["ready", "disabled"].includes(redis.status);

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    service: "backend",
    checks: {
      database,
      redis,
    },
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/patients", patientRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/medical-records", medicalRecordRoutes);
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/intelligence", intelligenceRoutes);
app.use("/api/v1/telemedicine", telemedicineRoutes);

// Phase 1 API Mounts
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/v1/admin", adminDashboardRoutes);

// Phase 2 API Mounts
app.use("/api/patients", patientRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/v1/records", recordRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/v1/documents", documentRoutes);

// Phase 3 API Mounts
app.use("/api/invoices", invoiceRoutes);
app.use("/api/v1/invoices", invoiceRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
