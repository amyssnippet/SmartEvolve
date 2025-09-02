const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const logger = require('../src/utils/logger');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Create demo user
    const demoUser = await User.create({
      email: 'demo@aiplatform.com',
      username: 'demo_user',
      password_hash: 'demo123456', // Will be hashed by model hook
      first_name: 'Demo',
      last_name: 'User',
      token_balance: 5000
    });

    // Create demo project
    await Project.create({
      user_id: demoUser.id,
      name: 'My First Project',
      description: 'Demo project for testing the AI platform',
      visibility: 'private'
    });

    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
