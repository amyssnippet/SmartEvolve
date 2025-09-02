const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class ModelRecord extends Model {}

ModelRecord.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  storage_file_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'storage_files',
      key: 'id'
    }
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
    allowNull: true,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  training_job_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'training_jobs',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING(50),
    defaultValue: 'v1.0'
  },
  description: DataTypes.TEXT,
  base_model: {
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
  framework: {
    type: DataTypes.ENUM('pytorch', 'transformers', 'tensorflow', 'custom'),
    allowNull: false
  },
  model_size: DataTypes.STRING(50),
  parameters_count: DataTypes.BIGINT,
  quantization: DataTypes.STRING(50),
  metrics: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  hyperparameters: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  training_config: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  license: DataTypes.STRING(100),
  model_card: DataTypes.TEXT,
  deployment_status: {
    type: DataTypes.ENUM('not_deployed', 'deploying', 'deployed', 'failed'),
    defaultValue: 'not_deployed'
  },
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
  modelName: 'Model',
  tableName: 'models',
  underscored: true
});

// Associations
ModelRecord.associate = (models) => {
  ModelRecord.belongsTo(models.StorageFile, {
    foreignKey: 'storage_file_id',
    as: 'storageFile'
  });
  ModelRecord.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  ModelRecord.belongsTo(models.Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
  ModelRecord.belongsTo(models.TrainingJob, {
    foreignKey: 'training_job_id',
    as: 'trainingJob'
  });
};

module.exports = ModelRecord;
