const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}

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
const { labTestsRouter, labOrdersRouter, labReportsRouter } = require("./routes/labRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const pharmacyRoutes = require("./routes/pharmacyRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const storageRoutes = require("./routes/storageRoutes");
const pushRoutes = require("./routes/pushRoutes");
const systemHealthRoutes = require("./routes/systemHealthRoutes");
const betaFeedbackRoutes = require("./routes/betaFeedback");
const businessRoutes = require("./routes/businessRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const minioService = require("./services/minioService");
const backupScheduler = require("./services/backupScheduler");
const dbBackup = require("./jobs/dbBackup");
const { requestContext } = require("./middlewares/requestContext");
const { errorMiddleware, notFoundMiddleware } = require("./middlewares/errorMiddleware");
const logger = require("./utils/logger");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./utils/swagger");
const healthRouter = require("./routes/health");

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
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || "2mb",
  type: ["application/json", "application/fhir+json"],
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.API_RATE_LIMIT || 120),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// Health routes — Postgres + R2 + heap probes (replaces basic stubs)
app.use('/health',       healthRouter);
app.use('/api/health',   healthRouter);
app.use('/api/v1/health', healthRouter);
app.get('/ping', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));


// Provision MinIO buckets (non-blocking — failure does not abort startup)
minioService.ensureBuckets().catch((err) =>
  logger.error('MinIO: startup bucket provisioning failed', { error: err.message })
);

// Graceful Redis connection startup validation (non-blocking)
pingRedis()
  .then((redisStatus) => {
    if (redisStatus.enabled) {
      if (redisStatus.status === "ready") {
        logger.info("Redis: Startup connection check succeeded");
      } else {
        logger.warn("Redis: Startup connection check failed/skipped (Redis is optional)", { 
          status: redisStatus.status, 
          error: redisStatus.error 
        });
      }
    } else {
      logger.info("Redis: Disabled by configuration");
    }
  })
  .catch((err) => {
    logger.warn("Redis: Graceful startup validation check failed", { error: err.message });
  });

// Start backup scheduler — only on PM2 cluster instance 0 to avoid N duplicate schedulers.
// In non-PM2 mode, NODE_APP_INSTANCE is undefined → defaults to "0" → scheduler always starts.
if ((process.env.NODE_APP_INSTANCE ?? "0") === "0") {
  backupScheduler.start();
  dbBackup.start(); // Google Drive streaming backup — zero disk, daily 02:00 IST
}

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
app.use("/api/v1/business", businessRoutes);

// Phase 2 API Mounts
app.use("/api/patients", patientRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/v1/records", recordRoutes);
app.use("/api/medical-records", recordRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/v1/documents", documentRoutes);

// Phase 3 API Mounts
app.use("/api/invoices", invoiceRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);

// Phase 4 API Mounts
app.use("/api/lab-tests", labTestsRouter);
app.use("/api/lab-orders", labOrdersRouter);
app.use("/api/lab-reports", labReportsRouter);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/departments", departmentRoutes);

// Phase 5 API Mounts
app.use("/api/medicines", medicineRoutes);
app.use("/api/pharmacy", pharmacyRoutes);

// Phase 6 API Mounts
app.use("/api/v1/hospitals", hospitalRoutes);
app.use("/api/v1/storage", storageRoutes);
app.use("/api/v1/push", pushRoutes);
app.use("/api/v1/subscriptions", require("./routes/subscriptionRoutes"));
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/push", pushRoutes);

// Phase 7 — Production Hardening
app.use("/api/v1/system", systemHealthRoutes);

// Beta — in-app bug reporting loop
app.use("/api/beta-feedback", betaFeedbackRoutes);
app.use("/api/v1/beta-feedback", betaFeedbackRoutes);

// Phase 6.1 — FHIR R4 Foundation
app.use("/api/fhir", require("./fhir/routes/fhirRoutes"));

// Insurance Claims Module
app.use("/api/v1/insurance", require("./insurance/routes/insuranceRoutes"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
