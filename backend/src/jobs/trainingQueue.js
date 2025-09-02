const TrainingJob = require('../models/TrainingJob');
const VastInstance = require('../models/VastInstance');
const vastService = require('../services/vastService');
const trainingService = require('../services/trainingService');
const billingService = require('../services/billingService');
const logger = require('../utils/logger');

module.exports = async function processTrainingJob(job) {
  const { jobId } = job.data;
  
  try {
    logger.info(`Processing training job: ${jobId}`);
    
    // Get job details
    const trainingJob = await TrainingJob.findByPk(jobId);
    if (!trainingJob) {
      throw new Error('Training job not found');
    }

    if (trainingJob.status !== 'queued') {
      logger.warn(`Job ${jobId} is not in queued state: ${trainingJob.status}`);
      return;
    }

    // Update status to provisioning
    await trainingService.updateJobStatus(jobId, 'provisioning');

    // Charge tokens upfront
    const costEstimate = await trainingService.estimateJobCost({
      taskType: trainingJob.task_type,
      baseModel: trainingJob.base_model,
      config: trainingJob.config,
      maxRuntimeHours: trainingJob.max_runtime_hours
    });

    await billingService.chargeTokens(
      trainingJob.user_id,
      costEstimate.tokens,
      `Training job: ${trainingJob.job_name}`,
      jobId
    );

    await trainingJob.update({ tokens_used: costEstimate.tokens });

    // Search for suitable instances
    const instances = await vastService.searchInstances({
      gpu_name: trainingJob.config.gpu_type || 'RTX 3090',
      gpu_count: trainingJob.config.gpu_count || 1,
      max_price: trainingJob.config.max_hourly_cost || 2.0,
      verified: true
    });

    if (!instances.offers || instances.offers.length === 0) {
      throw new Error('No suitable instances available');
    }

    // Select best instance (lowest cost)
    const bestInstance = instances.offers.reduce((best, current) => 
      current.dph_total < best.dph_total ? current : best
    );

    // Create instance
    const vastInstance = await vastService.createInstance({
      askId: bestInstance.id,
      imageTag: getDockerImage(trainingJob.task_type),
      userId: trainingJob.user_id,
      trainingJobId: jobId,
      envVars: {
        TASK_TYPE: trainingJob.task_type,
        BASE_MODEL: trainingJob.base_model,
        JOB_CONFIG: JSON.stringify(trainingJob.config),
        HYPERPARAMETERS: JSON.stringify(trainingJob.hyperparameters)
      }
    });

    // Update job with instance ID
    await trainingJob.update({ vast_instance_id: vastInstance.id });

    // Wait for instance to be ready
    await waitForInstanceReady(vastInstance.id, 900); // 15 minutes timeout

    // Start training
    await startTraining(vastInstance, trainingJob);

    logger.info(`Training job started: ${jobId} on instance ${vastInstance.id}`);

  } catch (error) {
    logger.error(`Training job failed: ${jobId}`, error);
    
    // Update job status to failed
    await trainingService.updateJobStatus(jobId, 'failed', { error: error.message });
    
    // Refund tokens if job failed before starting
    const trainingJob = await TrainingJob.findByPk(jobId);
    if (trainingJob && trainingJob.status === 'provisioning') {
      await billingService.refundTokens(
        trainingJob.user_id,
        trainingJob.tokens_used || 0,
        `Refund for failed job: ${trainingJob.job_name}`
      );
    }

    throw error;
  }
};

function getDockerImage(taskType) {
  const imageMap = {
    'text_classification': 'aiplatform/text-training:latest',
    'text_generation': 'aiplatform/llm-training:latest',
    'question_answering': 'aiplatform/qa-training:latest',
    'named_entity_recognition': 'aiplatform/ner-training:latest',
    'image_classification': 'aiplatform/vision-training:latest',
    'custom': 'aiplatform/custom-training:latest'
  };

  return imageMap[taskType] || 'pytorch/pytorch:latest';
}

async function waitForInstanceReady(instanceId, timeoutSeconds = 900) {
  const startTime = Date.now();
  const timeout = timeoutSeconds * 1000;

  while (Date.now() - startTime < timeout) {
    const instance = await VastInstance.findByPk(instanceId);
    
    if (instance.status === 'running' && instance.ssh_host) {
      return true;
    }

    if (instance.status === 'failed') {
      throw new Error('Instance failed to start');
    }

    // Wait 30 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  throw new Error('Instance startup timeout');
}

async function startTraining(instance, job) {
  try {
    // Execute training script on the instance
    const trainCommand = `
      cd /workspace &&
      python train.py \
        --job-id ${job.id} \
        --task-type ${job.task_type} \
        --base-model ${job.base_model} \
        --config '${JSON.stringify(job.config)}' \
        --hyperparameters '${JSON.stringify(job.hyperparameters)}' \
        --api-url ${process.env.API_BASE_URL || 'http://host.docker.internal:8000'} \
        > /workspace/training.log 2>&1 &
    `;

    const result = await vastService.executeCommand(instance.id, trainCommand);
    
    if (result.code !== 0) {
      throw new Error(`Training start failed: ${result.stderr}`);
    }

    // Update job status to running
    await trainingService.updateJobStatus(job.id, 'running');
    
    logger.info(`Training started for job: ${job.id}`);

  } catch (error) {
    logger.error(`Failed to start training for job: ${job.id}`, error);
    throw error;
  }
}
