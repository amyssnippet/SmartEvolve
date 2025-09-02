const express = require('express');
const trainingController = require('../controllers/training.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { trainingValidation, queryValidation, uuidParam } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', 
  queryValidation.pagination,
  trainingController.getJobs
);

router.post('/', 
  rateLimits.training,
  trainingValidation.create,
  trainingController.createJob
);

router.get('/:id', 
  uuidParam('id'),
  trainingController.getJob
);

router.put('/:id', 
  uuidParam('id'),
  trainingValidation.update,
  trainingController.updateJob
);

router.post('/:id/cancel', 
  // rateLimits.strict,
  uuidParam('id'),
  trainingController.cancelJob
);

router.get('/:id/logs', 
  uuidParam('id'),
  trainingController.getJobLogs
);

router.get('/:id/metrics', 
  uuidParam('id'),
  trainingController.getJobMetrics
);

router.post('/estimate-cost', 
  // // rateLimits.general,
  trainingController.estimateCost
);

module.exports = router;
