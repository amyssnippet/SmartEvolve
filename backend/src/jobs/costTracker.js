const VastInstance = require('../models/VastInstance');
const TrainingJob = require('../models/TrainingJob');
const BillingTransaction = require('../models/BillingTransaction');
const vastService = require('../services/vastService');
const logger = require('../utils/logger');

module.exports = async function trackCosts(job) {
  const { instanceId } = job.data;
  
  try {
    const instance = await VastInstance.findByPk(instanceId);
    if (!instance) {
      logger.warn(`Instance not found for cost tracking: ${instanceId}`);
      return;
    }

    if (instance.status !== 'running') {
      logger.debug(`Instance ${instanceId} not running, skipping cost tracking`);
      return;
    }

    // Calculate runtime since last update
    const lastUpdate = instance.updated_at;
    const now = new Date();
    const runtimeMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
    
    if (runtimeMinutes < 1) {
      return; // Less than a minute, skip
    }

    // Calculate cost increment
    const costIncrement = (instance.hourly_cost / 60) * runtimeMinutes;
    
    // Update instance total cost and runtime
    await instance.update({
      total_cost: instance.total_cost + costIncrement,
      runtime_minutes: instance.runtime_minutes + runtimeMinutes,
      updated_at: now
    });

    // Update associated training job cost
    if (instance.training_job_id) {
      const job = await TrainingJob.findByPk(instance.training_job_id);
      if (job) {
        const platformFee = costIncrement * 0.5; // 50% markup
        const totalCost = costIncrement + platformFee;
        
        await job.update({
          cost_incurred: job.cost_incurred + totalCost
        });

        // Create billing transaction
        await BillingTransaction.create({
          user_id: job.user_id,
          training_job_id: job.id,
          transaction_type: 'charge',
          amount: totalCost,
          vast_cost: costIncrement,
          platform_fee: platformFee,
          description: `Runtime cost for ${runtimeMinutes} minutes`
        });

        logger.debug(`Cost tracked: $${totalCost.toFixed(4)} for job ${job.id}`);
      }
    }

    // Check for budget limits and auto-termination
    await checkBudgetLimits(instance);

  } catch (error) {
    logger.error(`Cost tracking failed for instance ${instanceId}:`, error);
    throw error;
  }
};

async function checkBudgetLimits(instance) {
  try {
    if (instance.training_job_id) {
      const job = await TrainingJob.findByPk(instance.training_job_id, {
        include: [{ model: require('../models/User'), as: 'user' }]
      });

      if (job) {
        // Check if job cost exceeds estimate by 50%
        const costOverrun = job.cost_incurred / job.cost_estimate;
        if (costOverrun > 1.5) {
          logger.warn(`Job ${job.id} cost overrun: ${(costOverrun * 100).toFixed(1)}%`);
          
          // Auto-pause if significant overrun
          if (costOverrun > 2.0) {
            await require('../services/trainingService').updateJobStatus(
              job.id, 
              'paused', 
              { reason: 'Cost overrun - exceeded 200% of estimate' }
            );
          }
        }

        // Check user token balance
        if (job.user.token_balance < 100) { // Less than $1 worth
          logger.warn(`User ${job.user_id} low token balance: ${job.user.token_balance}`);
          
          if (job.user.token_balance <= 0) {
            await require('../services/trainingService').updateJobStatus(
              job.id, 
              'paused', 
              { reason: 'Insufficient token balance' }
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to check budget limits:', error);
  }
}
