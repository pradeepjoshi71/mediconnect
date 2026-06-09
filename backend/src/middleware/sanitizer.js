'use strict';

/**
 * sanitizer.js — Deep XSS & SQLi payload sanitizer middleware.
 *
 * Iterates req.body, req.query, and req.params, escaping HTML special chars
 * and stripping the most dangerous SQL injection patterns from every string
 * value — with zero external dependencies.
 *
 * Safe by design:
 *  - Non-string values (numbers, booleans, null, arrays, objects) are
 *    recursively walked but never coerced or dropped.
 *  - A cloned copy is written back; the original request object is not mutated
 *    in place at the prototype level.
 *  - Designed to run BEFORE body-parser validation, not as a replacement for
 *    parameterised queries or schema validation.
 */

// ─── HTML / XSS escape map ────────────────────────────────────────────────────
// Escapes the five characters that enable HTML injection and all <script> variants.
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

// ─── SQLi pattern strip list ──────────────────────────────────────────────────
// Targets the most common blind/union/comment injection patterns.
// This is a defence-in-depth layer — parameterised queries remain the primary guard.
const SQLI_PATTERNS = [
  /(\b)(union\s+select|select\s+\*|insert\s+into|drop\s+table|delete\s+from|update\s+\w+\s+set|exec\s*\(|execute\s*\(|xp_cmdshell|information_schema|sys\.tables)/gi,
  /(--|#|\/\*[\s\S]*?\*\/)/g,              // SQL comment sequences: --, #, /* */
  /;\s*(drop|delete|truncate|alter)\s/gi,  // Chained destructive statements
  /\b(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi, // Classic 1=1 tautologies
];

// ─── Core sanitise function ───────────────────────────────────────────────────

/**
 * Recursively sanitises a value:
 *  - Strings  → HTML-escaped + SQLi patterns stripped
 *  - Arrays   → each element sanitised
 *  - Objects  → each own-property value sanitised (returns a shallow clone)
 *  - Others   → returned unchanged
 *
 * @param {*} value
 * @returns {*}
 */
function sanitize(value) {
  if (typeof value === 'string') {
    // 1. Strip null bytes (used to bypass pattern matching)
    let clean = value.replace(/\0/g, '');

    // 2. Escape HTML special characters
    clean = clean.replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch]);

    // 3. Strip known SQLi patterns
    for (const pattern of SQLI_PATTERNS) {
      clean = clean.replace(pattern, '');
    }

    return clean.trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitize(value[key]);
    }
    return sanitized;
  }

  // number, boolean, null, undefined — pass through untouched
  return value;
}

// ─── Express middleware ───────────────────────────────────────────────────────

/**
 * Attaches sanitised copies to req.body, req.query, and req.params.
 * Does NOT block the request — dirty input is cleaned, not rejected.
 * Pair with Joi/Zod schema validation in the controller layer to reject
 * structurally invalid payloads after sanitisation.
 */
function sanitizer(req, res, next) {
  try {
    if (req.body   && typeof req.body   === 'object') req.body   = sanitize(req.body);
    if (req.query  && typeof req.query  === 'object') req.query  = sanitize(req.query);
    if (req.params && typeof req.params === 'object') req.params = sanitize(req.params);
  } catch (err) {
    // Sanitisation must never crash the request pipeline
    console.error('[sanitizer] Unexpected error during sanitisation:', err.message);
  }

  next();
}

module.exports = sanitizer;
