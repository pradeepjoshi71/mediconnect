const Redis = require("ioredis");
const logger = require("../utils/logger");

const redisEnabled = process.env.REDIS_ENABLED !== "false";
const redisUrl = process.env.REDIS_URL;

let client = null;
let connectPromise = null;
let status = redisEnabled ? "idle" : "disabled";

function buildClient() {
  if (!redisEnabled) return null;
  if (client) return client;

  client = redisUrl
    ? new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      })
    : new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      });

  client.on("ready", () => {
    status = "ready";
    logger.info("Redis connection ready");
  });

  client.on("error", (error) => {
    status = "error";
    logger.warn("Redis connection error", { error: error.message });
  });

  client.on("close", () => {
    if (status !== "disabled") {
      status = "closed";
    }
  });

  return client;
}

async function getRedisClient() {
  if (!redisEnabled) return null;

  const redis = buildClient();
  if (!redis) return null;

  if (redis.status === "ready") {
    status = "ready";
    return redis;
  }

  if (!connectPromise) {
    connectPromise = redis
      .connect()
      .catch((error) => {
        status = "error";
        logger.warn("Redis connection skipped", { error: error.message });
        return null;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  await connectPromise;
  return redis.status === "ready" ? redis : null;
}

async function getJson(key) {
  const redis = await getRedisClient();
  if (!redis) return null;

  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function setJson(key, value, ttlSeconds = 60) {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return true;
}

async function removeKey(key) {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.del(key);
  return true;
}

async function pingRedis() {
  const redis = await getRedisClient();
  if (!redis) return { enabled: redisEnabled, status };

  try {
    await redis.ping();
    return { enabled: true, status: "ready" };
  } catch (error) {
    return {
      enabled: true,
      status: "error",
      error: error.message,
    };
  }
}

function getRedisStatus() {
  return {
    enabled: redisEnabled,
    status,
  };
}

module.exports = {
  getRedisClient,
  getJson,
  setJson,
  removeKey,
  pingRedis,
  getRedisStatus,
};
