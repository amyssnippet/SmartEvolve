const express = require('express');
const storageController = require('../controllers/storage.controller');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { storageValidation, datasetValidation, queryValidation, uuidParam } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// File upload endpoints (require authentication)
router.post('/upload', 
  authMiddleware,
  rateLimits.upload,
  upload.single('file'),
  storageValidation.upload,
  storageController.uploadFile
);

// Chunked upload endpoints
router.post('/upload/chunked/init', 
  authMiddleware,
  rateLimits.upload,
  storageController.initChunkedUpload
);

router.post('/upload/chunked/:uploadId/chunk/:chunkIndex', 
  authMiddleware,
  rateLimits.upload,
  upload.single('chunk'),
  storageController.uploadChunk
);

router.post('/upload/chunked/:uploadId/complete', 
  authMiddleware,
  rateLimits.upload,
  storageController.completeChunkedUpload
);

// Dataset and model creation
router.post('/datasets', 
  authMiddleware,
  datasetValidation.create,
  storageController.createDataset
);

router.post('/models', 
  authMiddleware,
  storageController.createModel
);

// File operations
router.get('/files', 
  authMiddleware,
  queryValidation.pagination,
  storageController.listFiles
);

router.get('/files/:fileId/download', 
  optionalAuth,
  uuidParam('fileId'),
  storageController.downloadFile
);

router.delete('/files/:fileId', 
  authMiddleware,
  // rateLimits.strict,
  uuidParam('fileId'),
  storageController.deleteFile
);

// Public files
router.get('/public', 
  queryValidation.pagination,
  storageController.listPublicFiles
);

// Datasets
router.get('/datasets', 
  authMiddleware,
  queryValidation.pagination,
  storageController.listDatasets
);

// Models
router.get('/models', 
  authMiddleware,
  queryValidation.pagination,
  storageController.listModels
);

// Archive creation
router.post('/archive', 
  authMiddleware,
  // // rateLimits.general,
  storageController.createArchive
);

// Storage statistics
router.get('/stats', 
  authMiddleware,
  storageController.getStorageStats
);

module.exports = router;
