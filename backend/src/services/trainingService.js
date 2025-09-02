const TrainingJob = require('../models/TrainingJob');
const VastInstance = require('../models/VastInstance');
const User = require('../models/User');
const vastService = require('./vastService');
const queueService = require('./queueService');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class TrainingService {
  async estimateJobCost(options) {
    const {
      taskType,
      baseModel,
      config = {},
      maxRuntimeHours = 24,
      gpuType = 'RTX 3090'
    } = options;

    try {
      // Base cost estimation logic
      const baseCostPerHour = this.getBaseCostPerHour(taskType, baseModel);
      const gpuMultiplier = this.getGPUMultiplier(gpuType);
      
      const estimatedHours = this.estimateTrainingTime(taskType, config);
      const actualHours = Math.min(estimatedHours, maxRuntimeHours);
      
      const vastCostPerHour = baseCostPerHour * gpuMultiplier;
      const totalVastCost = vastCostPerHour * actualHours;
      
      // Platform fee (50% markup)
      const platformFee = totalVastCost * 0.5;
      const totalCost = totalVastCost + platformFee;
      
      // Convert to tokens (1 USD = 100 tokens)
      const totalTokens = Math.ceil(totalCost * 100);

      return {
        cost: totalCost,
        vastCost: totalVastCost,
        platformFee: platformFee,
        tokens: totalTokens,
        estimatedHours: actualHours,
        costPerHour: vastCostPerHour + (platformFee / actualHours)
      };
    } catch (error) {
      logger.error('Failed to estimate job cost:', error);
      throw new Error('Cost estimation failed');
    }
  }

  getBaseCostPerHour(taskType, baseModel) {
    // Base costs per hour in USD
    const baseCosts = {
      'text_classification': 0.5,
      'text_generation': 1.2,
      'question_answering': 0.8,
      'named_entity_recognition': 0.6,
      'sentiment_analysis': 0.4,
      'translation': 1.0,
      'summarization': 1.0,
      'image_classification': 0.7,
      'object_detection': 1.5,
      'custom': 1.0
    };

    // Model size multipliers
    const modelMultipliers = {
      'small': 1.0,
      'base': 1.2,
      'large': 1.8,
      '7b': 2.5,
      '13b': 4.0,
      '70b': 8.0
    };

    let baseCost = baseCosts[taskType] || 1.0;
    
    // Adjust based on model size
    const modelSize = this.extractModelSize(baseModel);
    const multiplier = modelMultipliers[modelSize] || 1.0;
    
    return baseCost * multiplier;
  }

  getGPUMultiplier(gpuType) {
    const gpuMultipliers = {
      'RTX 3090': 1.0,
      'RTX 4090': 1.3,
      'A100': 2.5,
      'V100': 2.0,
      'T4': 0.6,
      'RTX 3080': 0.8
    };

    return gpuMultipliers[gpuType] || 1.0;
  }

  estimateTrainingTime(taskType, config) {
    // Estimate training time in hours based on task type and config
    const baseHours = {
      'text_classification': 2,
      'text_generation': 8,
      'question_answering': 4,
      'named_entity_recognition': 3,
      'sentiment_analysis': 1.5,
      'translation': 6,
      'summarization': 5,
      'image_classification': 3,
      'object_detection': 6,
      'custom': 4
    };

    let hours = baseHours[taskType] || 4;
    
    // Adjust based on epochs
    if (config.epochs) {
      hours = hours * (config.epochs / 3); // Assume 3 epochs as baseline
    }

    return Math.max(0.5, Math.min(hours, 48)); // Between 30 minutes and 48 hours
  }

  extractModelSize(modelName) {
    const lowerName = modelName.toLowerCase();
    
    if (lowerName.includes('70b')) return '70b';
    if (lowerName.includes('13b')) return '13b';
    if (lowerName.includes('7b')) return '7b';
    if (lowerName.includes('large')) return 'large';
    if (lowerName.includes('base')) return 'base';
    if (lowerName.includes('small')) return 'small';
    
    return 'base';
  }

  async updateJobStatus(jobId, status, metadata = {}) {
    try {
      const job = await TrainingJob.findByPk(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const updates = { status };
      
      if (status === 'running' && !job.started_at) {
        updates.started_at = new Date();
      } else if (['completed', 'failed', 'cancelled'].includes(status)) {
        updates.completed_at = new Date();
        if (status === 'failed') {
          updates.failed_at = new Date();
          updates.error_message = metadata.error;
        }
      }

      await job.update(updates);

      // Emit real-time update
      const io = require('../app').get('io');
      if (io) {
        io.to(`job_${jobId}`).emit('job_status_update', {
          jobId,
          status,
          metadata
        });
      }

      logger.info(`Job ${jobId} status updated to ${status}`);
      return job;
    } catch (error) {
      logger.error('Failed to update job status:', error);
      throw error;
    }
  }

  async cancelJob(jobId) {
    try {
      const job = await TrainingJob.findByPk(jobId, {
        include: [{ model: VastInstance, as: 'vastInstance' }]
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Terminate Vast.ai instance if exists
      if (job.vastInstance && job.vastInstance.status === 'running') {
        await vastService.terminateInstance(job.vastInstance.vast_contract_id);
      }

      // Update job status
      await this.updateJobStatus(jobId, 'cancelled');

      // Remove from queue if still queued
      await queueService.removeJob(jobId);

      // Refund unused tokens
      await this.refundUnusedTokens(job);

      logger.info(`Job cancelled: ${jobId}`);
      return job;
    } catch (error) {
      logger.error('Failed to cancel job:', error);
      throw error;
    }
  }

  async refundUnusedTokens(job) {
    try {
      if (job.status === 'queued' || job.status === 'provisioning') {
        // Full refund for jobs that haven't started
        const refundAmount = job.tokens_used || 0;
        
        if (refundAmount > 0) {
          const user = await User.findByPk(job.user_id);
          await user.update({
            token_balance: user.token_balance + refundAmount
          });

          logger.info(`Refunded ${refundAmount} tokens to user ${job.user_id}`);
        }
      }
    } catch (error) {
      logger.error('Failed to refund tokens:', error);
    }
  }

  async getJobLogs(jobId, lines = 100) {
    try {
      const redis = getRedisClient();
      const logs = await redis.lRange(`job_logs:${jobId}`, -lines, -1);
      
      return logs.map(log => {
        try {
          return JSON.parse(log);
        } catch {
          return { message: log, timestamp: new Date() };
        }
      });
    } catch (error) {
      logger.error('Failed to get job logs:', error);
      return [];
    }
  }

  async addJobLog(jobId, logEntry) {
    try {
      const redis = getRedisClient();
      const logData = {
        message: logEntry.message,
        level: logEntry.level || 'info',
        timestamp: new Date().toISOString(),
        source: logEntry.source || 'training'
      };

      // Store in Redis with expiration
      await redis.lPush(`job_logs:${jobId}`, JSON.stringify(logData));
      await redis.expire(`job_logs:${jobId}`, 7 * 24 * 60 * 60); // 7 days

      // Trim to keep only latest 1000 logs
      await redis.lTrim(`job_logs:${jobId}`, 0, 999);

      // Emit real-time log
      const io = require('../app').get('io');
      if (io) {
        io.to(`job_${jobId}`).emit('job_log', logData);
      }
    } catch (error) {
      logger.error('Failed to add job log:', error);
    }
  }

  async getJobMetrics(jobId) {
    try {
      const job = await TrainingJob.findByPk(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      return {
        progress: job.progress,
        current_epoch: job.current_epoch,
        total_epochs: job.total_epochs,
        current_step: job.current_step,
        total_steps: job.total_steps,
        metrics: job.metrics || {},
        cost_incurred: parseFloat(job.cost_incurred || 0),
        runtime_minutes: job.started_at 
          ? Math.floor((new Date() - job.started_at) / (1000 * 60))
          : 0
      };
    } catch (error) {
      logger.error('Failed to get job metrics:', error);
      throw error;
    }
  }

  async updateJobProgress(jobId, progress, metrics = {}) {
    try {
      const job = await TrainingJob.findByPk(jobId);
      if (!job) return;

      const updates = { progress };
      
      if (metrics.epoch) updates.current_epoch = metrics.epoch;
      if (metrics.step) updates.current_step = metrics.step;
      if (metrics.loss) {
        const currentMetrics = job.metrics || {};
        updates.metrics = { ...currentMetrics, ...metrics };
      }

      await job.update(updates);

      // Emit real-time update
      const io = require('../app').get('io');
      if (io) {
        io.to(`job_${jobId}`).emit('job_progress_update', {
          jobId,
          progress,
          metrics
        });
      }
    } catch (error) {
      logger.error('Failed to update job progress:', error);
    }
  }

  async handleJobCompletion(jobId, finalMetrics = {}) {
    try {
      const job = await TrainingJob.findByPk(jobId, {
        include: [{ model: VastInstance, as: 'vastInstance' }]
      });

      if (!job) return;

      // Update job status
      await this.updateJobStatus(jobId, 'completed', finalMetrics);

      // Terminate instance
      if (job.vastInstance) {
        await vastService.terminateInstance(job.vastInstance.vast_contract_id);
      }

      // Calculate final cost
      await this.calculateFinalCost(job);

      logger.info(`Job completed: ${jobId}`);
    } catch (error) {
      logger.error('Failed to handle job completion:', error);
    }
  }

  async calculateFinalCost(job) {
    try {
      if (!job.started_at) return;

      const runtimeMinutes = Math.floor((new Date() - job.started_at) / (1000 * 60));
      const runtimeHours = runtimeMinutes / 60;

      // Get instance cost
      const instance = job.vastInstance;
      if (instance) {
        const vastCost = instance.hourly_cost * runtimeHours;
        const platformFee = vastCost * 0.5;
        const totalCost = vastCost + platformFee;

        await job.update({
          cost_incurred: totalCost,
          runtime_minutes: runtimeMinutes
        });

        // Update instance total cost
        await instance.update({
          total_cost: vastCost,
          runtime_minutes: runtimeMinutes
        });
      }
    } catch (error) {
      logger.error('Failed to calculate final cost:', error);
    }
  }
}

module.exports = new TrainingService();
