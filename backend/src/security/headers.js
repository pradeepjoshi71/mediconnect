'use strict';

const helmet = require('helmet');

/**
 * Helmet security middleware with a strict Content Security Policy.
 *
 * Trusted origins:
 *  - Vercel:    *.vercel.app
 *  - Render:    *.onrender.com
 *  - Razorpay:  *.razorpay.com, checkout.razorpay.com
 *  - Firebase:  *.firebaseapp.com, *.firebase.google.com, *.googleapis.com
 */
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => {
    try {
      const u = new URL(o);
      return `${u.protocol}//${u.host}`;
    } catch {
      return o;
    }
  });

const trustedOrigins = [
  ...clientOrigins,
  'https://*.vercel.app',
  'https://*.firebaseapp.com',
  'https://*.googleapis.com',
  'https://firebasestorage.googleapis.com',
];

const securityHeaders = helmet({
  // ─── Content Security Policy ────────────────────────────────────────────────
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        // Razorpay checkout script
        'https://checkout.razorpay.com',
        // Firebase JS SDK (CDN)
        'https://www.gstatic.com',
        // Allow inline scripts only if absolutely needed — remove if unused
        // "'unsafe-inline'",
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for most component libraries
        'https://fonts.googleapis.com',
      ],

      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
      ],

      imgSrc: [
        "'self'",
        'data:',                          // base64 images
        'blob:',
        ...trustedOrigins,
      ],

      connectSrc: [
        "'self'",
        ...trustedOrigins,
        // Razorpay payment APIs
        'https://*.razorpay.com',
        'https://lumberjack.razorpay.com',
        // Firebase Auth, Firestore, Storage
        'https://*.firebase.google.com',
        'wss://*.firebaseio.com',         // Firestore real-time via WebSocket
      ],

      frameSrc: [
        "'self'",
        // Razorpay payment iframe
        'https://api.razorpay.com',
        'https://checkout.razorpay.com',
      ],

      frameAncestors: ["'none'"],         // Prevents clickjacking — no iframe embedding
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],

      // Enforce HTTPS upgrades for mixed-content
      upgradeInsecureRequests: [],
    },
  },

  // ─── HSTS ────────────────────────────────────────────────────────────────────
  strictTransportSecurity: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // ─── Other Helmet Defaults (explicitly enabled for clarity) ─────────────────
  crossOriginEmbedderPolicy: false,   // Set false if embedding Firebase/Razorpay iframes
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CDN assets
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true,          // X-Content-Type-Options: nosniff
  xDnsPrefetchControl: { allow: false },
  xDownloadOptions: true,             // X-Download-Options: noopen
  xFrameOptions: { action: 'deny' }, // X-Frame-Options: DENY
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  xPoweredBy: false,                  // Remove X-Powered-By: Express fingerprint
});

module.exports = securityHeaders;
