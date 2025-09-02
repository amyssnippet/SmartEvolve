const express = require('express');
const projectsController = require('../controllers/projects.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { projectValidation, queryValidation, uuidParam } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', 
  queryValidation.pagination,
  queryValidation.sorting,
  projectsController.getProjects
);

router.post('/', 
  // // rateLimits.general,
  projectValidation.create,
  projectsController.createProject
);

router.get('/:id', 
  uuidParam('id'),
  projectsController.getProject
);

router.put('/:id', 
  uuidParam('id'),
  projectValidation.update,
  projectsController.updateProject
);

router.delete('/:id', 
  // rateLimits.strict,
  uuidParam('id'),
  projectsController.deleteProject
);

router.get('/:id/stats', 
  uuidParam('id'),
  projectsController.getProjectStats
);

module.exports = router;
