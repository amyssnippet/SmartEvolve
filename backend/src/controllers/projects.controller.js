const Project = require('../models/Project');
const Dataset = require('../models/Dataset');
const Model = require('../models/Model');
const TrainingJob = require('../models/TrainingJob');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

class ProjectsController {
  // Get all user projects
  getProjects = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: req.user.id };
    
    if (status) whereClause.status = status;
    if (search) {
      whereClause.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }

    const projects = await Project.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updated_at', 'DESC']],
      include: [
        { model: Dataset, as: 'datasets', attributes: ['id', 'name'] },
        { model: Model, as: 'models', attributes: ['id', 'name'] },
        { 
          model: TrainingJob, 
          as: 'trainingJobs', 
          attributes: ['id', 'status'],
          limit: 5,
          order: [['created_at', 'DESC']]
        }
      ]
    });

    res.json({
      success: true,
      projects: projects.rows,
      pagination: {
        total: projects.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(projects.count / limit)
      }
    });
  });

  // Get single project
  getProject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findOne({
      where: { id, user_id: req.user.id },
      include: [
        { model: Dataset, as: 'datasets' },
        { model: Model, as: 'models' },
        { model: TrainingJob, as: 'trainingJobs' }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      project
    });
  });

  // Create new project
  createProject = asyncHandler(async (req, res) => {
    const { name, description, visibility = 'private', tags = [] } = req.body;

    const project = await Project.create({
      user_id: req.user.id,
      name,
      description,
      visibility,
      tags
    });

    logger.info(`Project created: ${name} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  });

  // Update project
  updateProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, visibility, tags } = req.body;

    const project = await Project.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (visibility !== undefined) updates.visibility = visibility;
    if (tags !== undefined) updates.tags = tags;

    await project.update(updates);

    logger.info(`Project updated: ${project.name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Project updated successfully',
      project
    });
  });

  // Delete project
  deleteProject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Check for active training jobs
    const activeJobs = await TrainingJob.count({
      where: {
        project_id: id,
        status: ['queued', 'provisioning', 'running']
      }
    });

    if (activeJobs > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete project with active training jobs'
      });
    }

    await project.update({ status: 'deleted' });

    logger.info(`Project deleted: ${project.name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  });

  // Get project statistics
  getProjectStats = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const [datasetsCount, modelsCount, jobsCount, totalCost] = await Promise.all([
      Dataset.count({ where: { project_id: id } }),
      Model.count({ where: { project_id: id } }),
      TrainingJob.count({ where: { project_id: id } }),
      TrainingJob.sum('cost_incurred', { where: { project_id: id } }) || 0
    ]);

    const jobsByStatus = await TrainingJob.findAll({
      where: { project_id: id },
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });

    res.json({
      success: true,
      stats: {
        datasetsCount,
        modelsCount,
        jobsCount,
        totalCost: parseFloat(totalCost),
        jobsByStatus: jobsByStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {})
      }
    });
  });
}

module.exports = new ProjectsController();
