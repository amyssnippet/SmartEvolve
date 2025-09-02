const StorageFile = require('../models/StorageFile');
const Dataset = require('../models/Dataset');
const Model = require('../models/Model');
const storageService = require('../services/storageService');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

class StorageController {
  // Upload file
  uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const { fileType, isPublic, projectId, metadata } = req.body;

    try {
      const fileData = {
        fileName: req.file.originalname,
        fileType: fileType || 'dataset',
        buffer: req.file.buffer,
        isPublic: isPublic === 'true',
        projectId: projectId || null
      };

      const parsedMetadata = metadata ? JSON.parse(metadata) : {};

      const storageFile = await storageService.uploadFile(
        req.user.id,
        fileData,
        parsedMetadata
      );

      logger.info(`File uploaded: ${req.file.originalname} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'File uploaded successfully',
        file: storageFile
      });
    } catch (error) {
      logger.error('File upload failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Initialize chunked upload
  initChunkedUpload = asyncHandler(async (req, res) => {
    const { fileName, fileSize, chunkSize } = req.body;

    try {
      const uploadSession = await storageService.initializeChunkedUpload(
        req.user.id,
        fileName,
        parseInt(fileSize),
        parseInt(chunkSize) || 1048576
      );

      res.json({
        success: true,
        uploadSession
      });
    } catch (error) {
      logger.error('Chunked upload init failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Upload chunk
  uploadChunk = asyncHandler(async (req, res) => {
    const { uploadId, chunkIndex } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No chunk data provided'
      });
    }

    try {
      const result = await storageService.uploadChunk(
        uploadId,
        parseInt(chunkIndex),
        req.file.buffer
      );

      res.json({
        success: true,
        progress: result
      });
    } catch (error) {
      logger.error('Chunk upload failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Complete chunked upload
  completeChunkedUpload = asyncHandler(async (req, res) => {
    const { uploadId } = req.params;
    const { fileType, isPublic, projectId } = req.body;

    try {
      const storageFile = await storageService.completeChunkedUpload(
        uploadId,
        req.user.id,
        fileType || 'dataset',
        isPublic === 'true',
        projectId || null
      );

      res.json({
        success: true,
        message: 'Upload completed successfully',
        file: storageFile
      });
    } catch (error) {
      logger.error('Complete chunked upload failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create dataset
  createDataset = asyncHandler(async (req, res) => {
    const {
      storageFileId,
      name,
      version,
      description,
      taskType,
      format,
      schemaInfo,
      rowCount,
      isPublic,
      projectId
    } = req.body;

    try {
      // Verify file ownership
      const storageFile = await StorageFile.findOne({
        where: { id: storageFileId, user_id: req.user.id }
      });

      if (!storageFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const dataset = await storageService.createDataset(
        req.user.id,
        projectId,
        {
          name,
          version,
          description,
          taskType,
          format,
          schemaInfo,
          rowCount,
          isPublic
        },
        storageFileId
      );

      logger.info(`Dataset created: ${name} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Dataset created successfully',
        dataset
      });
    } catch (error) {
      logger.error('Dataset creation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create model
  createModel = asyncHandler(async (req, res) => {
    const {
      storageFileId,
      name,
      version,
      baseModel,
      taskType,
      framework,
      modelSize,
      metrics,
      isPublic,
      projectId
    } = req.body;

    try {
      // Verify file ownership
      const storageFile = await StorageFile.findOne({
        where: { id: storageFileId, user_id: req.user.id }
      });

      if (!storageFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const model = await storageService.createModel(
        req.user.id,
        projectId,
        {
          name,
          version,
          baseModel,
          taskType,
          framework,
          modelSize,
          metrics,
          isPublic
        },
        storageFileId
      );

      logger.info(`Model created: ${name} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Model created successfully',
        model
      });
    } catch (error) {
      logger.error('Model creation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Download file
  downloadFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    try {
      const fileData = await storageService.downloadFile(fileId, req.user?.id);

      res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Length', fileData.size);

      fileData.stream.pipe(res);
    } catch (error) {
      logger.error('Download failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // List files
  listFiles = asyncHandler(async (req, res) => {
    const { fileType, projectId, page = 1, limit = 20 } = req.query;

    try {
      const files = await storageService.listUserFiles(
        req.user.id,
        fileType,
        projectId
      );

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedFiles = files.slice(startIndex, endIndex);

      res.json({
        success: true,
        files: paginatedFiles,
        pagination: {
          total: files.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(files.length / limit)
        }
      });
    } catch (error) {
      logger.error('Failed to list files:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // List public files
  listPublicFiles = asyncHandler(async (req, res) => {
    const { fileType, page = 1, limit = 20 } = req.query;

    try {
      const files = await storageService.listPublicFiles(fileType);

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedFiles = files.slice(startIndex, endIndex);

      res.json({
        success: true,
        files: paginatedFiles,
        pagination: {
          total: files.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(files.length / limit)
        }
      });
    } catch (error) {
      logger.error('Failed to list public files:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // List datasets
  listDatasets = asyncHandler(async (req, res) => {
    const { projectId, isPublic, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    if (isPublic === 'true') {
      whereClause.is_public = true;
    } else {
      whereClause.user_id = req.user.id;
      if (projectId) whereClause.project_id = projectId;
    }

    const datasets = await Dataset.findAndCountAll({
      where: whereClause,
      include: [{ model: StorageFile, as: 'storageFile' }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      datasets: datasets.rows,
      pagination: {
        total: datasets.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(datasets.count / limit)
      }
    });
  });

  // List models
  listModels = asyncHandler(async (req, res) => {
    const { projectId, isPublic, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    if (isPublic === 'true') {
      whereClause.is_public = true;
    } else {
      whereClause.user_id = req.user.id;
      if (projectId) whereClause.project_id = projectId;
    }

    const models = await Model.findAndCountAll({
      where: whereClause,
      include: [{ model: StorageFile, as: 'storageFile' }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      models: models.rows,
      pagination: {
        total: models.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(models.count / limit)
      }
    });
  });

  // Delete file
  deleteFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    try {
      await storageService.deleteFile(fileId, req.user.id);

      logger.info(`File deleted: ${fileId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      logger.error('File deletion failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create archive
  createArchive = asyncHandler(async (req, res) => {
    const { fileIds } = req.body;

    try {
      const archive = await storageService.createArchive(fileIds, req.user.id);

      res.json({
        success: true,
        message: 'Archive created successfully',
        archive
      });
    } catch (error) {
      logger.error('Archive creation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get storage stats
  getStorageStats = asyncHandler(async (req, res) => {
    try {
      const stats = await storageService.getUserStorageStats(req.user.id);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = new StorageController();
