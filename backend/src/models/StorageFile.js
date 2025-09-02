const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class StorageFile extends Model {}

StorageFile.init({
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
    allowNull: true,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  file_path: {
    type: DataTypes.STRING(1000),
    allowNull: false,
    unique: true
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_type: {
    type: DataTypes.ENUM('dataset', 'model', 'checkpoint', 'log', 'artifact'),
    allowNull: false
  },
  mime_type: {
    type: DataTypes.STRING(100)
  },
  file_size: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  checksum: {
    type: DataTypes.STRING(64)
  },
  storage_location: {
    type: DataTypes.ENUM('local', 'distributed', 'cloud'),
    defaultValue: 'local'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  access_level: {
    type: DataTypes.ENUM('public', 'private', 'shared'),
    defaultValue: 'private'
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('uploading', 'active', 'archived', 'deleted'),
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
  modelName: 'StorageFile',
  tableName: 'storage_files',
  underscored: true
});

// Associations
StorageFile.associate = (models) => {
  StorageFile.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  StorageFile.belongsTo(models.Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
};

module.exports = StorageFile;
