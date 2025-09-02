const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

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
        resetTime: new Date(Date.now() + 900000)
      };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
    }
  }

  async decrement(key) {
    try {
      await this.client.decr(key);
    } catch (error) {
      logger.error('Redis rate limit decrement error:', error);
    }
  }

  async resetKey(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis rate limit reset error:', error);
    }
  }
}

// General API rate limiting
const createRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    store: new RedisStore(getRedisClient())
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Specific rate limits for different endpoints
const rateLimits = {
  // General API rate limit
  general: createRateLimit({
    max: 1000,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    }
  }),

  // Authentication endpoints
  auth: createRateLimit({
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: {
      error: 'Too many authentication attempts',
      message: 'Please wait before trying to authenticate again.'
    },
    keyGenerator: (req) => `auth:${req.ip}`
  }),

  // File upload endpoints
  upload: createRateLimit({
    max: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: {
      error: 'Upload limit exceeded',
      message: 'Too many file uploads. Please wait before uploading more files.'
    }
  }),

  // Training job creation
  training: createRateLimit({
    max: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: {
      error: 'Training job limit exceeded',
      message: 'Too many training jobs created. Please wait before creating more.'
    }
  }),

  // Vast.ai API calls
  vast: createRateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: {
      error: 'Vast.ai API limit exceeded',
      message: 'Too many Vast.ai API calls. Please wait before making more requests.'
    }
  }),

  // Payment endpoints
  payment: createRateLimit({
    max: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: {
      error: 'Payment limit exceeded',
      message: 'Too many payment attempts. Please wait before trying again.'
    }
  }),

  // Strict rate limit for sensitive operations
  strict: createRateLimit({
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: {
      error: 'Strict rate limit exceeded',
      message: 'Too many sensitive operations. Please wait before trying again.'
    }
  })
};

// Dynamic rate limiting based on user tier
const createDynamicRateLimit = (req, res, next) => {
  const user = req.user;
  let maxRequests = 100; // default
  
  if (user) {
    // Adjust based on user tier, token balance, etc.
    if (user.token_balance > 10000) {
      maxRequests = 500;
    } else if (user.token_balance > 5000) {
      maxRequests = 250;
    }
  }

  const dynamicLimit = createRateLimit({
    max: maxRequests,
    keyGenerator: (req) => req.user ? `user:${req.user.id}` : `ip:${req.ip}`
  });

  return dynamicLimit(req, res, next);
};

// Rate limit bypass for admin users
const adminBypass = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return rateLimits.general(req, res, next);
};

module.exports = {
  rateLimits,
  createRateLimit,
  createDynamicRateLimit,
  adminBypass
};
