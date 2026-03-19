const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function signAccessToken({ userId, email, role, hospitalId, hospitalCode }) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");

  return jwt.sign(
    {
      sub: String(userId),
      email,
      role,
      hospitalId,
      hospitalCode,
    },
    secret,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      issuer: "mediconnect-api",
      audience: "mediconnect-clients",
    }
  );
}

function signRefreshToken({ userId, hospitalId, hospitalCode }) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");

  return jwt.sign(
    {
      sub: String(userId),
      typ: "refresh",
      hospitalId,
      hospitalCode,
    },
    secret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
      issuer: "mediconnect-api",
      audience: "mediconnect-clients",
    }
  );
}

function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return jwt.verify(token, secret, {
    issuer: "mediconnect-api",
    audience: "mediconnect-clients",
  });
}

function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
  return jwt.verify(token, secret, {
    issuer: "mediconnect-api",
    audience: "mediconnect-clients",
  });
}

function hashRefreshToken(token) {
  return sha256(token);
}

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "strict" : "lax",
    secure: isProd,
    path: "/api/v1/auth",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  refreshCookieOptions,
};
