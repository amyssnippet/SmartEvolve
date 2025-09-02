const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class RedisStore {
  constructor(redisClient) {
    this.client = redisClient;
  }

  async increment(key) {
    try {
      const client = getRedisClient();
      if (!client) throw new Error('Redis client not initialized');

      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, 900);
      }
      return { totalHits: current, resetTime: new Date(Date.now() + 900000) };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
    }
  }

  async decrement(key) {
    try {
      const client = getRedisClient();
      if (client) await client.decr(key);
    } catch (error) {
      logger.error('Redis rate limit decrement error:', error);
    }
  }

  async resetKey(key) {
    try {
      const client = getRedisClient();
      if (client) await client.del(key);
    } catch (error) {
      logger.error('Redis rate limit reset error:', error);
    }
  }
}

const createRateLimit = (options = {}) => {
  const client = getRedisClient();
  if (!client) {
    logger.error('Redis not ready for rate limiter: Redis client not initialized');
    // fallback: use in-memory store
    return rateLimit({ ...options });
  }

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(client),
    ...options,
  });
};

const rateLimits = {
  general: createRateLimit({ max: 1000 }),
  auth: createRateLimit({ max: 10 }),
  upload: createRateLimit({ max: 50, windowMs: 60 * 60 * 1000 }),
  training: createRateLimit({ max: 20, windowMs: 60 * 60 * 1000 }),
  vast: createRateLimit({ max: 100, windowMs: 60 * 60 * 1000 }),
  payment: createRateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  strict: createRateLimit({ max: 5 }),
};

module.exports = { rateLimits, createRateLimit };
