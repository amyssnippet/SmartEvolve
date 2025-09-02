const VastInstance = require('../models/VastInstance');
const TrainingJob = require('../models/TrainingJob');
const vastService = require('../services/vastService');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

class VastController {
  // Get available instances
  searchInstances = asyncHandler(async (req, res) => {
    const {
      gpuType,
      gpuCount = 1,
      maxPrice,
      region,
      minRam,
      verified = true
    } = req.query;

    const searchCriteria = {
      gpu_name: gpuType,
      gpu_count: parseInt(gpuCount),
      max_price: maxPrice ? parseFloat(maxPrice) : undefined,
      region,
      min_ram: minRam ? parseInt(minRam) : undefined,
      verified: verified === 'true'
    };

    const instances = await vastService.searchInstances(searchCriteria);

    res.json({
      success: true,
      instances: instances.offers || [],
      count: instances.offers?.length || 0
    });
  });

  // Get user's instances
  getUserInstances = asyncHandler(async (req, res) => {
    const { status } = req.query;

    const whereClause = { user_id: req.user.id };
    if (status) whereClause.status = status;

    const instances = await VastInstance.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        { 
          model: TrainingJob, 
          as: 'trainingJob',
          attributes: ['id', 'job_name', 'status']
        }
      ]
    });

    res.json({
      success: true,
      instances
    });
  });

  // Get single instance
  getInstance = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const instance = await VastInstance.findOne({
      where: { id, user_id: req.user.id },
      include: [
        { model: TrainingJob, as: 'trainingJob' }
      ]
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    // Get live status from Vast.ai
    const liveStatus = await vastService.getInstanceStatus(instance.vast_contract_id);
    
    // Update local status if different
    if (liveStatus && liveStatus.status !== instance.status) {
      await instance.update({ 
        status: liveStatus.status,
        ssh_host: liveStatus.ssh_host,
        ssh_port: liveStatus.ssh_port
      });
    }

    res.json({
      success: true,
      instance,
      liveStatus
    });
  });

  // Create new instance
  createInstance = asyncHandler(async (req, res) => {
    const {
      askId,
      imageTag = 'pytorch/pytorch:latest',
      trainingJobId,
      envVars = {}
    } = req.body;

    // Validate training job if provided
    let trainingJob = null;
    if (trainingJobId) {
      trainingJob = await TrainingJob.findOne({
        where: { id: trainingJobId, user_id: req.user.id }
      });

      if (!trainingJob) {
        return res.status(404).json({
          success: false,
          error: 'Training job not found'
        });
      }
    }

    try {
      const instance = await vastService.createInstance({
        askId: parseInt(askId),
        imageTag,
        userId: req.user.id,
        trainingJobId,
        envVars
      });

      logger.info(`Vast instance created: ${instance.id} for user: ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Instance created successfully',
        instance
      });
    } catch (error) {
      logger.error('Failed to create Vast instance:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Terminate instance
  terminateInstance = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const instance = await VastInstance.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    if (instance.status === 'terminated') {
      return res.status(400).json({
        success: false,
        error: 'Instance already terminated'
      });
    }

    try {
      await vastService.terminateInstance(instance.vast_contract_id);
      
      await instance.update({
        status: 'terminated',
        terminated_at: new Date()
      });

      logger.info(`Vast instance terminated: ${instance.id} by user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Instance terminated successfully'
      });
    } catch (error) {
      logger.error('Failed to terminate Vast instance:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get instance metrics
  getInstanceMetrics = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const instance = await VastInstance.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    const metrics = await vastService.getInstanceMetrics(instance.vast_contract_id);

    res.json({
      success: true,
      metrics
    });
  });

  // Get pricing estimate
  getPricingEstimate = asyncHandler(async (req, res) => {
    const {
      gpuType,
      gpuCount = 1,
      hours = 1,
      region
    } = req.query;

    const estimate = await vastService.getPricingEstimate({
      gpuType,
      gpuCount: parseInt(gpuCount),
      hours: parseFloat(hours),
      region
    });

    res.json({
      success: true,
      estimate
    });
  });

  // Get instance templates
  getTemplates = asyncHandler(async (req, res) => {
    const templates = await vastService.getInstanceTemplates();

    res.json({
      success: true,
      templates
    });
  });
}

module.exports = new VastController();
