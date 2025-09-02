const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../../storage');
const UPLOAD_TEMP = path.join(__dirname, '../../uploads/temp');

const STORAGE_PATHS = {
  OPEN_SOURCE_MODELS: path.join(STORAGE_ROOT, 'open-source/models'),
  OPEN_SOURCE_DATASETS: path.join(STORAGE_ROOT, 'open-source/datasets'),
  USERS_ROOT: path.join(STORAGE_ROOT, 'users'),
  TEMP_UPLOADS: UPLOAD_TEMP
};

class StorageConfig {
  static async initializeStorage() {
    try {
      // Create base directories
      await fs.ensureDir(STORAGE_PATHS.OPEN_SOURCE_MODELS);
      await fs.ensureDir(STORAGE_PATHS.OPEN_SOURCE_DATASETS);
      await fs.ensureDir(STORAGE_PATHS.USERS_ROOT);
      await fs.ensureDir(STORAGE_PATHS.TEMP_UPLOADS);
      
      // Create logs directory
      await fs.ensureDir(path.join(__dirname, '../../logs'));
      
      logger.info('Storage directories initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  static getUserStoragePath(userId, type = null) {
    const userPath = path.join(STORAGE_PATHS.USERS_ROOT, userId);
    if (!type) return userPath;
    return path.join(userPath, type); // 'models' or 'datasets'
  }

  static getOpenSourcePath(type) {
    return type === 'models' 
      ? STORAGE_PATHS.OPEN_SOURCE_MODELS 
      : STORAGE_PATHS.OPEN_SOURCE_DATASETS;
  }

  static async ensureUserDirectories(userId) {
    const userRoot = this.getUserStoragePath(userId);
    const modelsPath = this.getUserStoragePath(userId, 'models');
    const datasetsPath = this.getUserStoragePath(userId, 'datasets');
    
    await fs.ensureDir(userRoot);
    await fs.ensureDir(modelsPath);
    await fs.ensureDir(datasetsPath);
    
    return { userRoot, modelsPath, datasetsPath };
  }

  static buildFilePath(userId, fileType, fileName, isPublic = false) {
    if (isPublic) {
      const basePath = this.getOpenSourcePath(fileType);
      return path.join(basePath, fileName);
    } else {
      const userTypePath = this.getUserStoragePath(userId, fileType);
      return path.join(userTypePath, fileName);
    }
  }

  static getStorageStats() {
    return {
      storageRoot: STORAGE_ROOT,
      tempPath: UPLOAD_TEMP,
      maxFileSize: process.env.STORAGE_MAX_FILE_SIZE || '10737418240',
      allowedTypes: process.env.STORAGE_ALLOWED_TYPES || 'csv,json,zip,tar,gz,pkl,pt,safetensors,bin'
    };
  }
}

module.exports = {
  StorageConfig,
  STORAGE_PATHS,
  initializeStorage: StorageConfig.initializeStorage
};
