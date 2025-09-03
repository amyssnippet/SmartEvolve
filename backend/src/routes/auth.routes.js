const express = require('express');
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { userValidation } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// Public routes
router.post('/register', 
  rateLimits.auth,
  userValidation.register,
  authController.register
);

router.post('/login', 
  rateLimits.auth,
  userValidation.login,
  authController.login
);

// Protected routes
router.get('/profile', 
  authMiddleware,
  authController.getProfile
);

router.put('/profile', 
  authMiddleware,
  userValidation.updateProfile,
  authController.updateProfile
);

router.post('/change-password', 
  authMiddleware,
  rateLimits.strict,
  authController.changePassword
);

router.post('/refresh-token', 
  authMiddleware,
  authController.refreshToken
);

router.post('/logout', 
  authMiddleware,
  authController.logout
);

module.exports = router;
