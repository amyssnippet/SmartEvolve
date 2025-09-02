const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Generic validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User validation rules
const userValidation = {
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('username')
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username must be 3-30 characters, alphanumeric with _ or -'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character'),
    body('firstName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be 1-100 characters'),
    body('lastName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be 1-100 characters'),
    handleValidationErrors
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be 1-100 characters'),
    body('lastName')  
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be 1-100 characters'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username must be 3-30 characters, alphanumeric with _ or -'),
    handleValidationErrors
  ]
};

// Project validation rules
const projectValidation = {
  create: [
    body('name')
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name is required and must be less than 255 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('visibility')
      .optional()
      .isIn(['private', 'public', 'shared'])
      .withMessage('Visibility must be private, public, or shared'),
    handleValidationErrors
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Valid project ID is required'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be less than 255 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('visibility')
      .optional()
      .isIn(['private', 'public', 'shared'])
      .withMessage('Visibility must be private, public, or shared'),
    handleValidationErrors
  ],

  get: [
    param('id')
      .isUUID()
      .withMessage('Valid project ID is required'),
    handleValidationErrors
  ]
};

// Training job validation rules
const trainingValidation = {
  create: [
    body('jobName')
      .isLength({ min: 1, max: 255 })
      .withMessage('Job name is required'),
    body('taskType')
      .isIn([
        'text_classification', 'text_generation', 'question_answering',
        'named_entity_recognition', 'sentiment_analysis', 'translation',
        'summarization', 'image_classification', 'object_detection', 'custom'
      ])
      .withMessage('Invalid task type'),
    body('baseModel')
      .notEmpty()
      .withMessage('Base model is required'),
    body('datasetId')
      .optional()
      .isUUID()
      .withMessage('Valid dataset ID required'),
    body('projectId')
      .isUUID()
      .withMessage('Valid project ID is required'),
    body('config')
      .optional()
      .isObject()
      .withMessage('Config must be an object'),
    body('hyperparameters')
      .optional()
      .isObject()
      .withMessage('Hyperparameters must be an object'),
    handleValidationErrors
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Valid job ID is required'),
    body('status')
      .optional()
      .isIn(['queued', 'provisioning', 'running', 'paused', 'completed', 'failed', 'cancelled'])
      .withMessage('Invalid status'),
    handleValidationErrors
  ]
};

// Dataset validation rules
const datasetValidation = {
  create: [
    body('name')
      .isLength({ min: 1, max: 255 })
      .withMessage('Dataset name is required'),
    body('taskType')
      .optional()
      .isIn([
        'text_classification', 'text_generation', 'question_answering',
        'named_entity_recognition', 'sentiment_analysis', 'translation',
        'summarization', 'image_classification', 'object_detection', 'custom'
      ])
      .withMessage('Invalid task type'),
    body('format')
      .isIn(['csv', 'json', 'jsonl', 'parquet', 'txt', 'zip', 'hf_dataset'])
      .withMessage('Invalid format'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be boolean'),
    handleValidationErrors
  ]
};

// Storage validation rules
const storageValidation = {
  upload: [
    body('fileType')
      .isIn(['dataset', 'model', 'checkpoint', 'log', 'artifact'])
      .withMessage('Invalid file type'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be boolean'),
    body('projectId')
      .optional()
      .isUUID()
      .withMessage('Valid project ID required'),
    handleValidationErrors
  ]
};

// Billing validation rules
const billingValidation = {
  createPayment: [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Amount must be a positive number'),
    body('currency')
      .optional()
      .isIn(['INR', 'USD'])
      .withMessage('Currency must be INR or USD'),
    handleValidationErrors
  ]
};

// Query parameter validation
const queryValidation = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],

  sorting: [
    query('sortBy')
      .optional()
      .isIn(['created_at', 'updated_at', 'name', 'status'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    handleValidationErrors
  ]
};

// UUID parameter validation
const uuidParam = (paramName = 'id') => [
  param(paramName)
    .isUUID()
    .withMessage(`Valid ${paramName} is required`),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  userValidation,
  projectValidation,
  trainingValidation,
  datasetValidation,
  storageValidation,
  billingValidation,
  queryValidation,
  uuidParam
};
