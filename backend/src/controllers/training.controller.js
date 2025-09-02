const TrainingJob = require('../models/TrainingJob');
const VastInstance = require('../models/VastInstance');
const Project = require('../models/Project');
const Dataset = require('../models/Dataset');
const trainingService = require('../services/trainingService');
const vastService = require('../services/vastService');
const queueService = require('../services/queueService');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

class TrainingController {
  // Get all training jobs for user
  getJobs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, projectId } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: req.user.id };
    if (status) whereClause.status = status;
    if (projectId) whereClause.project_id = projectId;

    const jobs = await TrainingJob.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: Dataset, as: 'dataset', attributes: ['id', 'name'] },
        { model: VastInstance, as: 'vastInstance', attributes: ['id', 'status', 'gpu_name'] }
      ]
    });

    res.json({
      success: true,
      jobs: jobs.rows,
      pagination: {
        total: jobs.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(jobs.count / limit)
      }
    });
  });

  // Get single training job
  getJob = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await TrainingJob.findOne({
      where: { id, user_id: req.user.id },
      include: [
        { model: Project, as: 'project' },
        { model: Dataset, as: 'dataset' },
        { model: VastInstance, as: 'vastInstance' }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    res.json({
      success: true,
      job
    });
  });

  // Create new training job
  createJob = asyncHandler(async (req, res) => {
    const {
      projectId,
      jobName,
      taskType,
      baseModel,
      datasetId,
      config = {},
      hyperparameters = {},
      maxRuntimeHours = 24
    } = req.body;

    // Validate project ownership
    const project = await Project.findOne({
      where: { id: projectId, user_id: req.user.id }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Validate dataset if provided
    if (datasetId) {
      const dataset = await Dataset.findOne({
        where: { id: datasetId, user_id: req.user.id }
      });

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: 'Dataset not found'
        });
      }
    }

    // Check user token balance
    const estimatedCost = await trainingService.estimateJobCost({
      taskType,
      baseModel,
      config,
      maxRuntimeHours
    });

    if (req.user.token_balance < estimatedCost.tokens) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient token balance',
        required: estimatedCost.tokens,
        available: req.user.token_balance
      });
    }

    // Create training job
    const job = await TrainingJob.create({
      user_id: req.user.id,
      project_id: projectId,
      dataset_id: datasetId,
      job_name: jobName,
      task_type: taskType,
      base_model: baseModel,
      config,
      hyperparameters,
      cost_estimate: estimatedCost.cost,
      max_runtime_hours: maxRuntimeHours,
      status: 'queued'
    });

    // Add to training queue
    await queueService.addTrainingJob(job.id);

    logger.info(`Training job created: ${jobName} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Training job created successfully',
      job,
      costEstimate: estimatedCost
    });
  });

  // Update training job
  updateJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const job = await TrainingJob.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    // Validate status transitions
    const validTransitions = {
      'queued': ['cancelled'],
      'provisioning': ['cancelled'],
      'running': ['paused', 'cancelled'],
      'paused': ['running', 'cancelled']
    };

    if (status && !validTransitions[job.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${job.status} to ${status}`
      });
    }

    if (status) {
      await trainingService.updateJobStatus(job.id, status);
    }

    await job.reload();

    logger.info(`Training job updated: ${job.job_name} status: ${status}`);

    res.json({
      success: true,
      message: 'Training job updated successfully',
      job
    });
  });

  // Cancel training job
  cancelJob = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await TrainingJob.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    if (!['queued', 'provisioning', 'running', 'paused'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel job in current status'
      });
    }

    await trainingService.cancelJob(job.id);

    logger.info(`Training job cancelled: ${job.job_name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Training job cancelled successfully'
    });
  });

  // Get job logs
  getJobLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { lines = 100 } = req.query;

    const job = await TrainingJob.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    const logs = await trainingService.getJobLogs(job.id, parseInt(lines));

    res.json({
      success: true,
      logs
    });
  });

  // Get job metrics
  getJobMetrics = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await TrainingJob.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    const metrics = await trainingService.getJobMetrics(job.id);

    res.json({
      success: true,
      metrics
    });
  });

  // Estimate job cost
  estimateCost = asyncHandler(async (req, res) => {
    const {
      taskType,
      baseModel,
      config = {},
      maxRuntimeHours = 24,
      gpuType = 'RTX 3090'
    } = req.body;

    const estimate = await trainingService.estimateJobCost({
      taskType,
      baseModel,
      config,
      maxRuntimeHours,
      gpuType
    });

    res.json({
      success: true,
      estimate
    });
  });
}

module.exports = new TrainingController();
