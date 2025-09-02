const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No valid token provided.' 
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid token. User not found.' 
        });
      }

      if (user.status !== 'active') {
        return res.status(401).json({ 
          error: 'Account is not active.' 
        });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token.' 
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error.' 
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = user;
      }
    } catch (jwtError) {
      // Ignore token errors for optional auth
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  optionalAuth,
  adminMiddleware
};
