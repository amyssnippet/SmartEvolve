const express = require('express');
const vastController = require('../controllers/vast.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { uuidParam } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/search', 
  rateLimits.vast,
  vastController.searchInstances
);

router.get('/instances', 
  vastController.getUserInstances
);

router.post('/instances', 
  rateLimits.vast,
  vastController.createInstance
);

router.get('/instances/:id', 
  uuidParam('id'),
  vastController.getInstance
);

router.delete('/instances/:id', 
  rateLimits.vast,
  uuidParam('id'),
  vastController.terminateInstance
);

router.get('/instances/:id/metrics', 
  uuidParam('id'),
  vastController.getInstanceMetrics
);

router.get('/pricing-estimate', 
  rateLimits.vast,
  vastController.getPricingEstimate
);

router.get('/templates', 
  vastController.getTemplates
);

module.exports = router;
