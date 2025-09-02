const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class Dataset extends Model {}

Dataset.init({
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING(50),
    defaultValue: 'v1.0'
  },
  description: {
    type: DataTypes.TEXT
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
    )
  },
  format: {
    type: DataTypes.ENUM('csv', 'json', 'jsonl', 'parquet', 'txt', 'zip', 'hf_dataset'),
    allowNull: false
  },
  schema_info: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  statistics: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  row_count: DataTypes.INTEGER,
  column_count: DataTypes.INTEGER,
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  license: DataTypes.STRING(100),
  citation: DataTypes.TEXT,
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
  modelName: 'Dataset',
  tableName: 'datasets',
  underscored: true
});

// Associations
Dataset.associate = (models) => {
  Dataset.belongsTo(models.StorageFile, {
    foreignKey: 'storage_file_id',
    as: 'storageFile'
  });
  Dataset.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  Dataset.belongsTo(models.Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
  Dataset.hasMany(models.TrainingJob, {
    foreignKey: 'dataset_id',
    as: 'trainingJobs'
  });
};

module.exports = Dataset;
