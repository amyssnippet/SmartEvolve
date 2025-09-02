const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthService {
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async hashPassword(password) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return bcrypt.hash(password, rounds);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async createUser(userData) {
    try {
      const user = await User.create({
        ...userData,
        password_hash: userData.password
      });

      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      return await User.findOne({ where: { email } });
    } catch (error) {
      logger.error('Failed to get user by email:', error);
      throw error;
    }
  }

  async getUserById(id) {
    try {
      return await User.findByPk(id);
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  async updateLastLogin(userId) {
    try {
      await User.update(
        { last_login: new Date() },
        { where: { id: userId } }
      );
    } catch (error) {
      logger.error('Failed to update last login:', error);
    }
  }

  async validateUserCredentials(email, password) {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }

    const isValidPassword = await user.checkPassword(password);
    
    if (!isValidPassword) {
      return null;
    }

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    return user;
  }

  generateResetToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  generateVerificationToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }
}

module.exports = new AuthService();
