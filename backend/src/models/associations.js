const User = require('./User');
const Project = require('./Project');
const StorageFile = require('./StorageFile');
const Dataset = require('./Dataset');
const Model = require('./Model');
const TrainingJob = require('./TrainingJob');
const VastInstance = require('./VastInstance');
const BillingTransaction = require('./BillingTransaction');
const PaymentOrder = require('./PaymentOrder');
const UploadSession = require('./UploadSession');

function setupAssociations() {
  // User associations
  User.hasMany(Project, { foreignKey: 'user_id', as: 'projects' });
  User.hasMany(StorageFile, { foreignKey: 'user_id', as: 'files' });
  User.hasMany(Dataset, { foreignKey: 'user_id', as: 'datasets' });
  User.hasMany(Model, { foreignKey: 'user_id', as: 'models' });
  User.hasMany(TrainingJob, { foreignKey: 'user_id', as: 'trainingJobs' });
  User.hasMany(VastInstance, { foreignKey: 'user_id', as: 'vastInstances' });
  User.hasMany(BillingTransaction, { foreignKey: 'user_id', as: 'transactions' });
  User.hasMany(PaymentOrder, { foreignKey: 'user_id', as: 'paymentOrders' });
  User.hasMany(UploadSession, { foreignKey: 'user_id', as: 'uploadSessions' });

  // Project associations
  Project.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Project.hasMany(StorageFile, { foreignKey: 'project_id', as: 'files' });
  Project.hasMany(Dataset, { foreignKey: 'project_id', as: 'datasets' });
  Project.hasMany(Model, { foreignKey: 'project_id', as: 'models' });
  Project.hasMany(TrainingJob, { foreignKey: 'project_id', as: 'trainingJobs' });

  // StorageFile associations
  StorageFile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  StorageFile.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
  StorageFile.hasMany(Dataset, { foreignKey: 'storage_file_id', as: 'datasets' });
  StorageFile.hasMany(Model, { foreignKey: 'storage_file_id', as: 'models' });

  // Dataset associations
  Dataset.belongsTo(StorageFile, { foreignKey: 'storage_file_id', as: 'storageFile' });
  Dataset.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Dataset.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
  Dataset.hasMany(TrainingJob, { foreignKey: 'dataset_id', as: 'trainingJobs' });

  // Model associations
  Model.belongsTo(StorageFile, { foreignKey: 'storage_file_id', as: 'storageFile' });
  Model.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Model.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
  Model.belongsTo(TrainingJob, { foreignKey: 'training_job_id', as: 'trainingJob' });

  // TrainingJob associations (THIS IS THE KEY FIX!)
  TrainingJob.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  TrainingJob.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
  TrainingJob.belongsTo(Dataset, { foreignKey: 'dataset_id', as: 'dataset' });
  TrainingJob.belongsTo(VastInstance, { foreignKey: 'vast_instance_id', as: 'vastInstance' });
  TrainingJob.hasMany(Model, { foreignKey: 'training_job_id', as: 'models' });
  TrainingJob.hasMany(BillingTransaction, { foreignKey: 'training_job_id', as: 'transactions' });

  // VastInstance associations
  VastInstance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  VastInstance.belongsTo(TrainingJob, { foreignKey: 'training_job_id', as: 'trainingJob' });
  VastInstance.hasMany(TrainingJob, { foreignKey: 'vast_instance_id', as: 'jobs' });

  // BillingTransaction associations
  BillingTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  BillingTransaction.belongsTo(TrainingJob, { foreignKey: 'training_job_id', as: 'trainingJob' });
  BillingTransaction.belongsTo(PaymentOrder, { foreignKey: 'payment_order_id', as: 'paymentOrder' });

  // PaymentOrder associations
  PaymentOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  PaymentOrder.hasMany(BillingTransaction, { foreignKey: 'payment_order_id', as: 'transactions' });

  // UploadSession associations
  UploadSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  console.log('All model associations set up successfully');
}

module.exports = { setupAssociations };
