const { getSequelize } = require('../config/database');

let models = {};

const initializeAllModels = (sequelize) => {
  // Import and initialize all models
  const User = require('./User');
  const Project = require('./Project');
  const StorageFile = require('./StorageFile');
  const Dataset = require('./Dataset');
  const ModelRecord = require('./Model');
  const TrainingJob = require('./TrainingJob');
  const VastInstance = require('./VastInstance');
  const BillingTransaction = require('./BillingTransaction');
  const PaymentOrder = require('./PaymentOrder');
  const UploadSession = require('./UploadSession');

  // Initialize models with sequelize instance
  User.init(User.getAttributes(), { sequelize, ...User.getOptions() });
  Project.init(Project.getAttributes(), { sequelize, ...Project.getOptions() });
  // ... repeat for other models

  // Set up associations
  setupAssociations();

  models = {
    User,
    Project,
    StorageFile,
    Dataset,
    Model: ModelRecord,
    TrainingJob,
    VastInstance,
    BillingTransaction,
    PaymentOrder,
    UploadSession
  };

  return models;
};

const setupAssociations = () => {
  const { User, Project, StorageFile, Dataset, Model, TrainingJob, VastInstance } = models;

  // User associations
  User.hasMany(Project, { foreignKey: 'user_id', as: 'projects' });
  User.hasMany(StorageFile, { foreignKey: 'user_id', as: 'files' });
  User.hasMany(TrainingJob, { foreignKey: 'user_id', as: 'trainingJobs' });

  // Project associations
  Project.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Project.hasMany(Dataset, { foreignKey: 'project_id', as: 'datasets' });
  Project.hasMany(Model, { foreignKey: 'project_id', as: 'models' });

  // ... other associations
};

module.exports = {
  initializeAllModels,
  models
};
