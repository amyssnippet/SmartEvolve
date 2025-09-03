const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const { setupAssociations } = require('../models/associations');

let sequelize;

const initializeDatabase = async () => {
  try {
    // ✅ Direct connection without env vars
    sequelize = new Sequelize(
      'smartevolve',        // database name
      'postgres_se',      // username
      '1234',  // password
      {
        host: 'localhost',  // or your DB host/IP
        port: 5432,         // default Postgres port
        dialect: 'postgres',
        logging: (msg) => logger.debug(msg), // always log with your logger
        pool: {
          max: 20,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        dialectOptions: {
          // remove if you don’t need SSL
          ssl: false,
        },
      }
    );

    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Import and initialize models AFTER sequelize is created
    await initializeModels();

    await setupAssociations();
    logger.info('Model associations set up successfully');
    
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

const getSequelize = () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sequelize;
};

module.exports = {
  sequelize,
  initializeDatabase,
  getSequelize,
};
