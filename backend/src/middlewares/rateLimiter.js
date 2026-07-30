'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

/**
 * Custom Key Generator: Keyed by IP Address + Tenant ID (hospital code/ID).
 */
function tenantIpKeyGenerator(req) {
  const ip =
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const tenantId =
    req.user?.hospitalId ||
    req.tenantCode ||
    req.headers['x-tenant-id'] ||
    req.headers['x-hospital-code'] ||
    req.headers['x-tenant-code'] ||
    req.params?.hospitalId ||
    req.query?.hospitalId ||
    'global';

  return `${ip}:${tenantId}`;
}

/**
 * Helper to build Redis-backed rate-limit store across PM2 cluster workers.
 */
function createRedisStore() {
  return new RedisStore({
    sendCommand: async (...args) => {
      const redis = await getRedisClient();
      if (!redis) {
        throw new Error('Redis client unavailable for rate-limiter store');
      }
      return redis.call(...args);
    },
    prefix: 'rl:tenant:',
  });
}

/**
 * Express Rate Limiter Middleware.
 * Returns HTTP 429 with explicit Retry-After header.
 * Uses RedisStore (rate-limit-redis) when Redis is enabled to share limit counters across PM2 processes.
 */
function createTenantRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const limit = options.limit || Number(process.env.API_RATE_LIMIT || 120);

  const config = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: tenantIpKeyGenerator,
    handler: (req, res, _next, options) => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfterSeconds,
      });
    },
    ...options,
  };

  if (!config.store && process.env.REDIS_ENABLED !== 'false' && process.env.NODE_ENV !== 'test') {
    try {
      config.store = createRedisStore();
    } catch (_) {
      // Fallback to MemoryStore if RedisStore initialization fails
    }
  }

  return rateLimit(config);
}

const defaultRateLimiter = createTenantRateLimiter();

module.exports = {
  createTenantRateLimiter,
  defaultRateLimiter,
  tenantIpKeyGenerator,
  createRedisStore,
};
