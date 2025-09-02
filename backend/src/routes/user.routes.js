const express = require('express');
const usersController = require('../controllers/users.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { queryValidation } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/dashboard', 
  // // rateLimits.general,
  usersController.getDashboard
);

router.get('/settings', 
  // // rateLimits.general,
  usersController.getSettings
);

router.put('/settings', 
  // // rateLimits.general,
  usersController.updateSettings
);

router.get('/activity', 
  queryValidation.pagination,
  usersController.getActivity
);

router.delete('/account', 
  // rateLimits.strict,
  usersController.deleteAccount
);

module.exports = router;
