const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
const logger = require('../utils/logger');

// Configure storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.STORAGE_ALLOWED_TYPES?.split(',') || [
    'csv', 'json', 'jsonl', 'txt', 'zip', 'tar', 'gz', 
    'pkl', 'pt', 'safetensors', 'bin', 'parquet'
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  const mimeType = mime.lookup(file.originalname);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024, // 10GB
    files: 10,
    fieldSize: 1024 * 1024 // 1MB
  },
  fileFilter: fileFilter
});

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        maxSize: process.env.STORAGE_MAX_FILE_SIZE || '10GB'
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        maxFiles: 10
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field',
        message: error.message
      });
    }
  } else if (error.message.includes('File type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  logger.error('Upload middleware error:', error);
  res.status(500).json({
    error: 'Upload error',
    message: 'An error occurred during file upload'
  });
};

// Validation middleware
const validateUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'No file provided'
    });
  }
  
  // Add file metadata
  if (req.file) {
    req.file.uploadedAt = new Date();
    req.file.uploadedBy = req.user?.id;
  }
  
  if (req.files) {
    Object.values(req.files).flat().forEach(file => {
      file.uploadedAt = new Date();
      file.uploadedBy = req.user?.id;
    });
  }
  
  next();
};

// Disk usage check middleware
const checkDiskSpace = async (req, res, next) => {
  try {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    await fs.ensureDir(uploadDir);
    
    // This is a simplified check - in production, implement proper disk space monitoring
    next();
  } catch (error) {
    logger.error('Disk space check error:', error);
    res.status(507).json({
      error: 'Insufficient storage space'
    });
  }
};

module.exports = {
  upload,
  handleUploadError,
  validateUpload,
  checkDiskSpace,
  
  // Specific upload configurations
  single: (fieldName) => [
    checkDiskSpace,
    upload.single(fieldName),
    handleUploadError,
    validateUpload
  ],
  
  multiple: (fieldName, maxCount = 10) => [
    checkDiskSpace,
    upload.array(fieldName, maxCount),
    handleUploadError,
    validateUpload
  ],
  
  fields: (fields) => [
    checkDiskSpace,
    upload.fields(fields),
    handleUploadError,
    validateUpload
  ]
};
