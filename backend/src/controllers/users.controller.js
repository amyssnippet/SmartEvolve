const User = require('../models/User');
const Project = require('../models/Project');
const TrainingJob = require('../models/TrainingJob');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

class UsersController {
  // Get user dashboard stats
  getDashboard = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      // Get user stats (these work fine without associations)
      const [projectsCount, activeJobsCount, completedJobsCount, totalCost] = await Promise.all([
        Project.count({ where: { user_id: userId } }),
        TrainingJob.count({ 
          where: { 
            user_id: userId, 
            status: ['queued', 'provisioning', 'running'] 
          } 
        }),
        TrainingJob.count({ 
          where: { 
            user_id: userId, 
            status: 'completed' 
          } 
        }),
        TrainingJob.sum('cost_incurred', { 
          where: { user_id: userId } 
        }) || 0
      ]);

      // Get recent activity with CORRECT association usage
      const recentJobs = await TrainingJob.findAll({
        where: { user_id: userId },
        limit: 5,
        order: [['created_at', 'DESC']],
        include: [
          { 
            model: Project, 
            as: 'project',  // This is the key - use the exact alias from associations
            attributes: ['id', 'name'] 
          }
        ]
      });

      res.json({
        success: true,
        dashboard: {
          stats: {
            projectsCount,
            activeJobsCount,
            completedJobsCount,
            totalCost: parseFloat(totalCost),
            tokenBalance: req.user.token_balance
          },
          recentActivity: recentJobs
        }
      });
    } catch (error) {
      logger.error('Dashboard query failed:', error);
      throw error;
    }
  });

  // Get user settings
  getSettings = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    res.json({
      success: true,
      settings: {
        profile: {
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name
        },
        preferences: user.metadata || {},
        account: {
          status: user.status,
          emailVerified: user.email_verified,
          tokenBalance: user.token_balance,
          createdAt: user.created_at
        }
      }
    });
  });

  // Update user settings
  updateSettings = asyncHandler(async (req, res) => {
    const { preferences } = req.body;

    if (preferences) {
      await req.user.update({
        metadata: { ...req.user.metadata, ...preferences }
      });
    }

    logger.info(`User settings updated: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  });

  // Get user activity history
  getActivity = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const jobs = await TrainingJob.findAndCountAll({
      where: { user_id: req.user.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name'] }
      ]
    });

    res.json({
      success: true,
      activity: {
        jobs: jobs.rows,
        pagination: {
          total: jobs.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(jobs.count / limit)
        }
      }
    });
  });

  // Delete user account
  deleteAccount = asyncHandler(async (req, res) => {
    const { confirmPassword } = req.body;

    // Verify password
    const isPasswordValid = await req.user.checkPassword(confirmPassword);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Password confirmation failed'
      });
    }

    // Check for active jobs
    const activeJobs = await TrainingJob.count({
      where: {
        user_id: req.user.id,
        status: ['queued', 'provisioning', 'running']
      }
    });

    if (activeJobs > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete account with active training jobs'
      });
    }

    // Soft delete - mark as inactive
    await req.user.update({ status: 'inactive' });

    logger.info(`User account deleted: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  });
}

module.exports = new UsersController();
