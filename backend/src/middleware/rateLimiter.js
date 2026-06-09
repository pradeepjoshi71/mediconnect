'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Global API rate limiter.
 *
 * - 100 requests / 15 minutes per IP
 * - Cloudflare-safe: reads the real IP from CF-Connecting-IP or X-Forwarded-For
 *   when app.set('trust proxy', 1) is enabled on the Express app.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // requests per window per IP
  standardHeaders: 'draft-7', // Return `RateLimit-*` headers (RFC 6585 successor)
  legacyHeaders: false,       // Disable deprecated `X-RateLimit-*` headers

  // Custom key generator — respects Cloudflare's CF-Connecting-IP header first,
  // then falls back to Express's req.ip (which honours trust proxy).
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again after 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000), // Unix timestamp
    });
  },

  skip: (req) => {
    // Bypass limiter for health-check probes (e.g., Render/Vercel uptime checks)
    return req.path === '/health' || req.path === '/ping';
  },
});

module.exports = limiter;
