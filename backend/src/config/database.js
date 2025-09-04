const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Create sequelize instance at module level
const sequelize = new Sequelize(
  'smartevolve',        // database name
  'postgres_se',        // username
  '1234',              // password
  {
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: false,
    },
  }
);

const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Import and initialize models AFTER sequelize is created
    await initializeModels();

    // Setup associations AFTER models are loaded
    await setupAssociations();
    
    // Auto sync
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');

    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
};

const initializeModels = async () => {
  // Import models here to avoid circular dependency
  require('../models/User');
  require('../models/Project');
  require('../models/Dataset');
  require('../models/Model');
  require('../models/TrainingJob');
  require('../models/VastInstance');
  require('../models/StorageFile');
  require('../models/BillingTransaction');
  require('../models/PaymentOrder');
  require('../models/UploadSession');
  
  logger.info('All models initialized successfully');
};

const setupAssociations = async () => {
  const { setupAssociations } = require('../models/associations');
  setupAssociations();
  logger.info('Model associations established successfully');
};

// Export sequelize instance directly - this is the key fix!
module.exports = {
  sequelize,           // Direct export of the instance
  initializeDatabase,
  getSequelize: () => sequelize  // Keep for compatibility but not used
};
