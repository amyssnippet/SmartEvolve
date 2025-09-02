const Bull = require('bull');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class QueueService {
  constructor() {
    this.queues = {};
    this.initializeQueues();
  }

  initializeQueues() {
    // Training job queue
    this.queues.training = new Bull('training jobs', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });

    // Cost tracking queue
    this.queues.costTracking = new Bull('cost tracking', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });

    // Instance monitoring queue
    this.queues.monitoring = new Bull('instance monitoring', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });

    // Storage cleanup queue
    this.queues.cleanup = new Bull('storage cleanup', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });

    this.setupQueueProcessors();
    this.setupQueueEvents();
  }

  setupQueueProcessors() {
    // Training job processor
    this.queues.training.process('processTrainingJob', require('../jobs/trainingQueue'));

    // Cost tracking processor
    this.queues.costTracking.process('trackCosts', require('../jobs/costTracker'));

    // Instance monitoring processor
    this.queues.monitoring.process('monitorInstances', require('../jobs/instanceMonitor'));

    // Storage cleanup processor
    this.queues.cleanup.process('cleanupStorage', require('../jobs/storageCleanup'));
  }

  setupQueueEvents() {
    Object.keys(this.queues).forEach(queueName => {
      const queue = this.queues[queueName];

      queue.on('completed', (job, result) => {
        logger.info(`Job completed in ${queueName}: ${job.id}`);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job failed in ${queueName}: ${job.id}`, err);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job stalled in ${queueName}: ${job.id}`);
      });
    });
  }

  async addTrainingJob(jobId, priority = 0) {
    try {
      const job = await this.queues.training.add('processTrainingJob', {
        jobId
      }, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      logger.info(`Training job queued: ${jobId}`);
      return job;
    } catch (error) {
      logger.error('Failed to queue training job:', error);
      throw error;
    }
  }

  async addCostTracking(instanceId) {
    try {
      const job = await this.queues.costTracking.add('trackCosts', {
        instanceId
      }, {
        repeat: { every: 60000 }, // Every minute
        attempts: 5
      });

      logger.info(`Cost tracking started for instance: ${instanceId}`);
      return job;
    } catch (error) {
      logger.error('Failed to start cost tracking:', error);
      throw error;
    }
  }

  async addInstanceMonitoring(instanceId) {
    try {
      const job = await this.queues.monitoring.add('monitorInstances', {
        instanceId
      }, {
        repeat: { every: 30000 }, // Every 30 seconds
        attempts: 10
      });

      logger.info(`Instance monitoring started: ${instanceId}`);
      return job;
    } catch (error) {
      logger.error('Failed to start instance monitoring:', error);
      throw error;
    }
  }

  async addStorageCleanup() {
    try {
      const job = await this.queues.cleanup.add('cleanupStorage', {}, {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        attempts: 3
      });

      logger.info('Storage cleanup scheduled');
      return job;
    } catch (error) {
      logger.error('Failed to schedule storage cleanup:', error);
      throw error;
    }
  }

  async removeJob(jobId) {
    try {
      // Remove from all queues
      for (const queueName of Object.keys(this.queues)) {
        const queue = this.queues[queueName];
        const jobs = await queue.getJobs(['waiting', 'delayed']);
        
        for (const job of jobs) {
          if (job.data.jobId === jobId) {
            await job.remove();
            logger.info(`Removed job ${jobId} from ${queueName} queue`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to remove job from queues:', error);
    }
  }

  async getQueueStats() {
    try {
      const stats = {};

      for (const [queueName, queue] of Object.entries(this.queues)) {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        stats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        };
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  async pauseQueue(queueName) {
    try {
      if (this.queues[queueName]) {
        await this.queues[queueName].pause();
        logger.info(`Queue paused: ${queueName}`);
      }
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}:`, error);
    }
  }

  async resumeQueue(queueName) {
    try {
      if (this.queues[queueName]) {
        await this.queues[queueName].resume();
        logger.info(`Queue resumed: ${queueName}`);
      }
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}:`, error);
    }
  }

  async clearQueue(queueName) {
    try {
      if (this.queues[queueName]) {
        await this.queues[queueName].empty();
        logger.info(`Queue cleared: ${queueName}`);
      }
    } catch (error) {
      logger.error(`Failed to clear queue ${queueName}:`, error);
    }
  }
}

module.exports = new QueueService();
