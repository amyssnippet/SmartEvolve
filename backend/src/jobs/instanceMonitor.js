const VastInstance = require('../models/VastInstance');
const TrainingJob = require('../models/TrainingJob');
const vastService = require('../services/vastService');
const trainingService = require('../services/trainingService');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');

module.exports = async function monitorInstances(job) {
  const { instanceId } = job.data;
  
  try {
    const instance = await VastInstance.findByPk(instanceId);
    if (!instance) {
      logger.warn(`Instance not found for monitoring: ${instanceId}`);
      return;
    }

    if (instance.status === 'terminated') {
      logger.debug(`Instance ${instanceId} already terminated, stopping monitoring`);
      return { removeJob: true }; // Remove this monitoring job
    }

    // Get live status from Vast.ai
    const liveStatus = await vastService.getInstanceStatus(instance.vast_contract_id);
    
    if (!liveStatus) {
      logger.warn(`Could not get status for instance ${instanceId}`);
      return;
    }

    // Update local status if different
    const statusChanged = liveStatus.actual_status !== instance.status;
    if (statusChanged) {
      await instance.update({
        status: liveStatus.actual_status,
        ssh_host: liveStatus.public_ipaddr,
        ssh_port: liveStatus.ssh_port,
        jupyter_url: liveStatus.jupyter_url,
        last_health_check: new Date()
      });

      logger.info(`Instance ${instanceId} status changed: ${instance.status} -> ${liveStatus.actual_status}`);
    }

    // Handle status-specific actions
    await handleStatusUpdate(instance, liveStatus);

    // Check for idle instances
    await checkIdleInstance(instance);

    // Health check if running
    if (instance.status === 'running' && instance.ssh_host) {
      await performHealthCheck(instance);
    }

  } catch (error) {
    logger.error(`Instance monitoring failed for ${instanceId}:`, error);
    
    // Update health status on error
    try {
      const instance = await VastInstance.findByPk(instanceId);
      if (instance) {
        await instance.update({ 
          health_status: 'unhealthy',
          last_health_check: new Date()
        });
      }
    } catch (updateError) {
      logger.error('Failed to update health status:', updateError);
    }
    
    throw error;
  }
};

async function handleStatusUpdate(instance, liveStatus) {
  try {
    switch (liveStatus.actual_status) {
      case 'running':
        await handleRunningInstance(instance);
        break;
        
      case 'stopped':
      case 'exited':
        await handleStoppedInstance(instance);
        break;
        
      case 'error':
      case 'failed':
        await handleFailedInstance(instance, liveStatus);
        break;
    }
  } catch (error) {
    logger.error('Failed to handle status update:', error);
  }
}

async function handleRunningInstance(instance) {
  // Update associated training job if not already running
  if (instance.training_job_id) {
    const job = await TrainingJob.findByPk(instance.training_job_id);
    if (job && job.status === 'provisioning') {
      await trainingService.updateJobStatus(job.id, 'running');
    }
  }

  // Start cost tracking if not already started
  await queueService.addCostTracking(instance.id);
}

async function handleStoppedInstance(instance) {
  if (instance.status !== 'stopped') {
    await instance.update({ status: 'stopped' });
    
    // Update associated training job
    if (instance.training_job_id) {
      const job = await TrainingJob.findByPk(instance.training_job_id);
      if (job && job.status === 'running') {
        await trainingService.updateJobStatus(job.id, 'completed');
        await trainingService.handleJobCompletion(job.id);
      }
    }
  }
}

async function handleFailedInstance(instance, liveStatus) {
  await instance.update({ 
    status: 'failed',
    health_status: 'unhealthy'
  });

  // Update associated training job
  if (instance.training_job_id) {
    const job = await TrainingJob.findByPk(instance.training_job_id);
    if (job && ['provisioning', 'running'].includes(job.status)) {
      await trainingService.updateJobStatus(
        job.id, 
        'failed', 
        { error: `Instance failed: ${liveStatus.error || 'Unknown error'}` }
      );
    }
  }

  logger.error(`Instance ${instance.id} failed: ${liveStatus.error || 'Unknown error'}`);
}

async function checkIdleInstance(instance) {
  try {
    if (!instance.auto_terminate || instance.status !== 'running') {
      return;
    }

    // Check if instance has been idle too long
    const idleMinutes = instance.max_idle_minutes || 30;
    const lastActivity = instance.last_health_check || instance.updated_at;
    const idleTime = (new Date() - lastActivity) / (1000 * 60);

    if (idleTime > idleMinutes) {
      // Check if training job is still active
      let shouldTerminate = true;
      
      if (instance.training_job_id) {
        const job = await TrainingJob.findByPk(instance.training_job_id);
        if (job && ['running', 'paused'].includes(job.status)) {
          shouldTerminate = false;
        }
      }

      if (shouldTerminate) {
        logger.info(`Terminating idle instance: ${instance.id} (idle for ${idleTime.toFixed(1)} minutes)`);
        await vastService.terminateInstance(instance.vast_contract_id);
      }
    }
  } catch (error) {
    logger.error('Failed to check idle instance:', error);
  }
}

async function performHealthCheck(instance) {
  try {
    // Simple SSH connectivity test
    const isHealthy = await vastService.testSSHConnection(
      instance.ssh_host,
      instance.ssh_port,
      5000 // 5 second timeout
    );

    const healthStatus = isHealthy ? 'healthy' : 'unhealthy';
    
    if (instance.health_status !== healthStatus) {
      await instance.update({
        health_status: healthStatus,
        last_health_check: new Date()
      });
      
      if (!isHealthy) {
        logger.warn(`Instance ${instance.id} failed health check`);
      }
    } else {
      // Update timestamp even if status unchanged
      await instance.update({ last_health_check: new Date() });
    }

  } catch (error) {
    logger.error(`Health check failed for instance ${instance.id}:`, error);
    
    await instance.update({
      health_status: 'unhealthy',
      last_health_check: new Date()
    });
  }
}
