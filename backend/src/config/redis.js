const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const initializeRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_unfulfilled_commands: true,
      retry_delay_on_cluster_down: 300,
      retry_delay_on_failover: 100,
      max_attempts: 3
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

module.exports = {
  initializeRedis,
  getRedisClient
};
