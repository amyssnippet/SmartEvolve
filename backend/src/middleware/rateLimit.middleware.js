const rateLimit = require("express-rate-limit");
const { getRedisClient } = require("../config/redis");
const logger = require("../utils/logger");

// Create a Redis store for rate limiting
class RedisStore {
  constructor(redisClient) {
    this.client = redisClient;
  }

  async increment(key) {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, 900); // 15 minutes
      }
      return {
        totalHits: current,
        resetTime: new Date(Date.now() + 900000),
      };
    } catch (error) {
      logger.error("Redis rate limit error:", error);
      return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
    }
  }

  async decrement(key) {
    try {
      await this.client.decr(key);
    } catch (error) {
      logger.error("Redis rate limit decrement error:", error);
    }
  }

  async resetKey(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Redis rate limit reset error:", error);
    }
  }
}

// Factory to create a limiter AFTER Redis is initialized
const createRateLimit = (options = {}) => {
  let client;
  try {
    client = getRedisClient(); // <-- now runs only when function is called
  } catch (err) {
    logger.error("Redis not ready for rate limiter:", err);
    throw err;
  }

  const rateLimits = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    store: new RedisStore(client),
  };

  return rateLimit({ ...defaultOptions, ...options });
};
