const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Project extends Model {}

Project.init({
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  visibility: {
    type: DataTypes.ENUM('private', 'public', 'shared'),
    defaultValue: 'private'
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('active', 'archived', 'deleted'),
    defaultValue: 'active'
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
  modelName: 'Project',
  tableName: 'projects',
  underscored: true
});

// Associations
Project.associate = (models) => {
  Project.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  Project.hasMany(models.Dataset, {
    foreignKey: 'project_id',
    as: 'datasets'
  });
  Project.hasMany(models.Model, {
    foreignKey: 'project_id',
    as: 'models'
  });
  Project.hasMany(models.TrainingJob, {
    foreignKey: 'project_id',
    as: 'trainingJobs'
  });
};

module.exports = Project;
