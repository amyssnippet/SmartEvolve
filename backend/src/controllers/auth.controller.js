const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authService = require('../services/authService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/error.middleware');

class AuthController {
  // Register new user
  register = asyncHandler(async (req, res) => {
    const { email, username, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: existingUser.email === email ? 
          'Email already registered' : 'Username already taken'
      });
    }

    // Create user
    const user = await User.create({
      email,
      username,
      password_hash: password, // Will be hashed by model hook
      first_name: firstName,
      last_name: lastName
    });

    // Generate token
    const token = authService.generateToken(user.id);

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: user.toJSON(),
      token
    });
  });

  // Login user
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.checkPassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check user status
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Account is not active'
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate token
    const token = authService.generateToken(user.id);

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  });

  // Get current user profile
  getProfile = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      user: req.user.toJSON()
    });
  });

  // Update user profile
  updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, username } = req.body;
    const updates = {};

    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (username !== undefined) {
      // Check if username is already taken
      const existingUser = await User.findOne({
        where: { 
          username,
          id: { [require('sequelize').Op.ne]: req.user.id }
        }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
      
      updates.username = username;
    }

    await req.user.update(updates);

    logger.info(`User profile updated: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: req.user.toJSON()
    });
  });

  // Change password
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await req.user.checkPassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    await req.user.update({ password_hash: newPassword });

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  // Refresh token
  refreshToken = asyncHandler(async (req, res) => {
    const token = authService.generateToken(req.user.id);

    res.json({
      success: true,
      token
    });
  });

  // Logout (client-side token removal)
  logout = asyncHandler(async (req, res) => {
    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

module.exports = new AuthController();
