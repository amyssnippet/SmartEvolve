const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class TrainingJob extends Model {}

TrainingJob.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  dataset_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'datasets',
      key: 'id'
    }
  },
  vast_instance_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'vast_instances',
      key: 'id'
    }
  },
  job_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  task_type: {
    type: DataTypes.ENUM(
      'text_classification',
      'text_generation',
      'question_answering',
      'named_entity_recognition',
      'sentiment_analysis',
      'translation',
      'summarization',
      'image_classification',
      'object_detection',
      'custom'
    ),
    allowNull: false
  },
  base_model: {
    type: DataTypes.STRING,
    allowNull: false
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  hyperparameters: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM(
      'queued',
      'provisioning',
      'running',
      'paused',
      'completed',
      'failed',
      'cancelled'
    ),
    defaultValue: 'queued'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  current_epoch: DataTypes.INTEGER,
  total_epochs: DataTypes.INTEGER,
  current_step: DataTypes.INTEGER,
  total_steps: DataTypes.INTEGER,
  metrics: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  logs: {
    type: DataTypes.TEXT
  },
  error_message: DataTypes.TEXT,
  cost_estimate: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0
  },
  cost_incurred: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0
  },
  tokens_used: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_runtime_hours: {
    type: DataTypes.INTEGER,
    defaultValue: 24
  },
  auto_resume: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notification_settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  started_at: DataTypes.DATE,
  completed_at: DataTypes.DATE,
  failed_at: DataTypes.DATE,
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'TrainingJob',
  tableName: 'training_jobs',
  underscored: true
});

// Associations
TrainingJob.associate = (models) => {
  TrainingJob.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  TrainingJob.belongsTo(models.Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
  TrainingJob.belongsTo(models.Dataset, {
    foreignKey: 'dataset_id',
    as: 'dataset'
  });
  TrainingJob.belongsTo(models.VastInstance, {
    foreignKey: 'vast_instance_id',
    as: 'vastInstance'
  });
  TrainingJob.hasMany(models.Model, {
    foreignKey: 'training_job_id',
    as: 'models'
  });
};

module.exports = TrainingJob;
