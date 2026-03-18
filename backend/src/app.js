const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const reportRoutes = require("./routes/reportRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

// Useful behind Nginx when proxying /api/*
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});
app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/availability", availabilityRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/payments", paymentRoutes);

module.exports = app;
