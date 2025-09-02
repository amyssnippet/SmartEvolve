const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class VastInstance extends Model {}

VastInstance.init({
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
  training_job_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'training_jobs',
      key: 'id'
    }
  },
  vast_contract_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
  ask_id: DataTypes.BIGINT,
  machine_id: DataTypes.BIGINT,
  instance_type: DataTypes.STRING(100),
  gpu_name: DataTypes.STRING(100),
  gpu_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  gpu_total_memory: DataTypes.INTEGER,
  cpu_cores: DataTypes.INTEGER,
  ram_gb: DataTypes.INTEGER,
  disk_gb: DataTypes.INTEGER,
  hourly_cost: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: false
  },
  region: DataTypes.STRING(100),
  country: DataTypes.STRING(100),
  ssh_host: DataTypes.STRING(255),
  ssh_port: DataTypes.INTEGER,
  ssh_user: {
    type: DataTypes.STRING(50),
    defaultValue: 'root'
  },
  jupyter_url: DataTypes.STRING(500),
  status: {
    type: DataTypes.ENUM(
      'provisioning',
      'starting',
      'running',
      'stopping',
      'stopped',
      'failed',
      'terminated'
    ),
    defaultValue: 'provisioning'
  },
  health_status: {
    type: DataTypes.ENUM('healthy', 'unhealthy', 'unknown'),
    defaultValue: 'unknown'
  },
  last_health_check: DataTypes.DATE,
  total_cost: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0
  },
  runtime_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  performance_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  auto_terminate: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  max_idle_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  terminated_at: DataTypes.DATE
}, {
  sequelize,
  modelName: 'VastInstance',
  tableName: 'vast_instances',
  underscored: true
});

// Associations
VastInstance.associate = (models) => {
  VastInstance.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  VastInstance.belongsTo(models.TrainingJob, {
    foreignKey: 'training_job_id',
    as: 'trainingJob'  
  });
  VastInstance.hasMany(models.TrainingJob, {
    foreignKey: 'vast_instance_id',
    as: 'jobs'
  });
};

module.exports = VastInstance;
