// Central model registry and initialization
const { getSequelize } = require('../config/database');

// Import all models
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

const models = {
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

// Export models for easy access
module.exports = models;
