const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class UploadSession extends Model {}

UploadSession.init({
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
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  chunk_size: {
    type: DataTypes.INTEGER,
    defaultValue: 1048576
  },
  total_chunks: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploaded_chunks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  temp_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  final_path: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'expired', 'failed'),
    defaultValue: 'active'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'UploadSession',
  tableName: 'upload_sessions',
  underscored: true
});

module.exports = UploadSession;
