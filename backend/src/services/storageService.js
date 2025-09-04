const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');
const archiver = require('archiver');

const { StorageConfig } = require('../config/storage');
const { StorageFile, Dataset, Model, UploadSession } = require('../models');
const fileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class StorageService {

  async uploadFile(userId, fileData, metadata = {}) {
    try {
      const { fileName, fileType, buffer, isPublic = false, projectId = null } = fileData;

      // CRITICAL FIX: Ensure user directories exist BEFORE attempting to save
      await StorageConfig.ensureUserDirectories(userId);

      // Generate safe filename
      const safeName = fileUtils.sanitizeFileName(fileName);
      const filePath = StorageConfig.buildFilePath(userId, fileType, safeName, isPublic);
      
      // Ensure the specific directory exists
      const fileDirectory = path.dirname(filePath);
      await fs.ensureDir(fileDirectory);
      
      // Generate unique filename if already exists
      const finalPath = await this.ensureUniqueFilename(filePath);
      
      // Calculate checksum
      const checksum = await fileUtils.calculateBufferChecksum(buffer);
      
      // Write file to disk
      await fs.writeFile(finalPath, buffer);
      
      // Get file stats
      const stats = await fs.stat(finalPath);
      
      // Create database record
      const storageFile = await StorageFile.create({
        user_id: userId,
        project_id: projectId,
        file_path: finalPath,
        file_name: path.basename(finalPath),
        file_type: fileType,
        mime_type: mime.lookup(fileName) || 'application/octet-stream',
        file_size: stats.size,
        checksum: checksum,
        storage_location: 'local',
        metadata: metadata,
        access_level: isPublic ? 'public' : 'private'
      });

      logger.info(`File uploaded: ${fileName} (${fileUtils.formatBytes(stats.size)})`);
      return storageFile;
      
    } catch (error) {
      logger.error('File upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async ensureUniqueFilename(filePath) {
    let counter = 0;
    let currentPath = filePath;
    
    while (await fs.pathExists(currentPath)) {
      counter++;
      const parsed = path.parse(filePath);
      currentPath = path.join(
        parsed.dir, 
        `${parsed.name}_${counter}${parsed.ext}`
      );
    }
    
    return currentPath;
  }

  async initializeChunkedUpload(userId, fileName, fileSize, chunkSize = 1048576) {
    try {
      const uploadId = crypto.randomUUID();
      const totalChunks = Math.ceil(fileSize / chunkSize);
      const tempDir = path.join(StorageConfig.STORAGE_PATHS.TEMP_UPLOADS, uploadId);
      
      await fs.ensureDir(tempDir);

      const uploadSession = await UploadSession.create({
        id: uploadId,
        user_id: userId,
        file_name: fileName,
        file_size: fileSize,
        chunk_size: chunkSize,
        total_chunks: totalChunks,
        temp_path: tempDir,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      logger.info(`Chunked upload initialized: ${fileName} (${totalChunks} chunks)`);
      return { uploadId, totalChunks, chunkSize };
    } catch (error) {
      logger.error('Failed to initialize chunked upload:', error);
      throw error;
    }
  }

  async uploadChunk(uploadId, chunkIndex, chunkBuffer) {
    try {
      const uploadSession = await UploadSession.findByPk(uploadId);
      if (!uploadSession || uploadSession.status !== 'active') {
        throw new Error('Invalid or expired upload session');
      }

      const chunkPath = path.join(uploadSession.temp_path, `chunk_${chunkIndex}`);
      await fs.writeFile(chunkPath, chunkBuffer);

      // Update uploaded chunks count
      await uploadSession.increment('uploaded_chunks');
      const updatedSession = await uploadSession.reload();

      logger.debug(`Chunk uploaded: ${chunkIndex + 1}/${uploadSession.total_chunks}`);

      return {
        uploaded: updatedSession.uploaded_chunks,
        total: uploadSession.total_chunks,
        progress: Math.round((updatedSession.uploaded_chunks / uploadSession.total_chunks) * 100)
      };
    } catch (error) {
      logger.error('Chunk upload failed:', error);
      throw error;
    }
  }

  async completeChunkedUpload(uploadId, userId, fileType, isPublic = false, projectId = null) {
    try {
      const uploadSession = await UploadSession.findByPk(uploadId);
      if (!uploadSession) {
        throw new Error('Upload session not found');
      }

      if (uploadSession.uploaded_chunks !== uploadSession.total_chunks) {
        throw new Error(`Missing chunks: ${uploadSession.uploaded_chunks}/${uploadSession.total_chunks}`);
      }

      // Ensure user directories
      await StorageConfig.ensureUserDirectories(userId);

      // Generate final file path
      const safeName = fileUtils.sanitizeFileName(uploadSession.file_name);
      const tempFinalPath = StorageConfig.buildFilePath(userId, fileType, safeName, isPublic);
      const finalPath = await this.ensureUniqueFilename(tempFinalPath);

      // Reassemble file
      const writeStream = fs.createWriteStream(finalPath);
      
      for (let i = 0; i < uploadSession.total_chunks; i++) {
        const chunkPath = path.join(uploadSession.temp_path, `chunk_${i}`);
        
        if (!(await fs.pathExists(chunkPath))) {
          throw new Error(`Missing chunk ${i}`);
        }
        
        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
      }
      
      writeStream.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verify file size
      const stats = await fs.stat(finalPath);
      if (stats.size !== uploadSession.file_size) {
        await fs.remove(finalPath);
        throw new Error('File size mismatch after reassembly');
      }

      // Calculate checksum
      const checksum = await fileUtils.calculateChecksum(finalPath);

      // Create storage file record
      const storageFile = await StorageFile.create({
        user_id: userId,
        project_id: projectId,
        file_path: finalPath,
        file_name: path.basename(finalPath),
        file_type: fileType,
        mime_type: mime.lookup(uploadSession.file_name) || 'application/octet-stream',
        file_size: uploadSession.file_size,
        checksum: checksum,
        storage_location: 'local',
        access_level: isPublic ? 'public' : 'private'
      });

      // Clean up temp files
      await fs.remove(uploadSession.temp_path);
      await uploadSession.update({ status: 'completed' });

      logger.info(`Chunked upload completed: ${uploadSession.file_name}`);
      return storageFile;
    } catch (error) {
      logger.error('Failed to complete chunked upload:', error);
      throw error;
    }
  }

  async createDataset(userId, projectId, datasetData, storageFileId) {
    try {
      const dataset = await Dataset.create({
        storage_file_id: storageFileId,
        user_id: userId,
        project_id: projectId,
        name: datasetData.name,
        version: datasetData.version || 'v1.0',
        description: datasetData.description,
        task_type: datasetData.taskType,
        format: datasetData.format,
        schema_info: datasetData.schemaInfo || {},
        row_count: datasetData.rowCount,
        is_public: datasetData.isPublic || false
      });

      logger.info(`Dataset created: ${datasetData.name}`);
      return dataset;
    } catch (error) {
      logger.error('Failed to create dataset:', error);
      throw error;
    }
  }

  async createModel(userId, projectId, modelData, storageFileId) {
    try {
      const model = await Model.create({
        storage_file_id: storageFileId,
        user_id: userId,
        project_id: projectId,
        name: modelData.name,
        version: modelData.version || 'v1.0',
        base_model: modelData.baseModel,
        task_type: modelData.taskType,
        framework: modelData.framework,
        model_size: modelData.modelSize,
        metrics: modelData.metrics || {},
        is_public: modelData.isPublic || false
      });

      logger.info(`Model created: ${modelData.name}`);
      return model;
    } catch (error) {
      logger.error('Failed to create model:', error);
      throw error;
    }
  }

  async getFile(fileId, userId = null) {
    try {
      const file = await StorageFile.findByPk(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Check access permissions
      if (file.access_level === 'private' && file.user_id !== userId) {
        throw new Error('Access denied');
      }

      return file;
    } catch (error) {
      logger.error('Failed to get file:', error);
      throw error;
    }
  }

  async downloadFile(fileId, userId = null) {
    try {
      const file = await this.getFile(fileId, userId);
      
      if (!(await fs.pathExists(file.file_path))) {
        throw new Error('File not found on disk');
      }

      // Increment download count
      await file.increment('download_count');

      logger.info(`File download: ${file.file_name}`);

      return {
        stream: fs.createReadStream(file.file_path),
        fileName: file.file_name,
        mimeType: file.mime_type,
        size: file.file_size
      };
    } catch (error) {
      logger.error('Failed to download file:', error);
      throw error;
    }
  }

  async deleteFile(fileId, userId) {
    try {
      const file = await StorageFile.findByPk(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      if (file.user_id !== userId) {
        throw new Error('Access denied');
      }

      // Delete physical file
      if (await fs.pathExists(file.file_path)) {
        await fs.remove(file.file_path);
      }

      // Delete database record
      await file.destroy();

      logger.info(`File deleted: ${file.file_name}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  async listUserFiles(userId, fileType = null, projectId = null) {
    try {
      const where = { user_id: userId };
      if (fileType) where.file_type = fileType;
      if (projectId) where.project_id = projectId;

      const files = await StorageFile.findAll({
        where,
        order: [['created_at', 'DESC']]
      });

      return files;
    } catch (error) {
      logger.error('Failed to list user files:', error);
      throw error;
    }
  }

  async listPublicFiles(fileType = null) {
    try {
      const where = { access_level: 'public' };
      if (fileType) where.file_type = fileType;

      const files = await StorageFile.findAll({
        where,
        order: [['created_at', 'DESC']]
      });

      return files;
    } catch (error) {
      logger.error('Failed to list public files:', error);
      throw error;
    }
  }

  async createArchive(fileIds, userId) {
    try {
      const files = await StorageFile.findAll({
        where: {
          id: fileIds,
          user_id: userId
        }
      });

      if (files.length === 0) {
        throw new Error('No files found');
      }

      const archiveName = `archive_${Date.now()}.zip`;
      const archivePath = path.join(StorageConfig.STORAGE_PATHS.TEMP_UPLOADS, archiveName);

      const filePaths = files.map(file => ({
        filePath: file.file_path,
        name: file.file_name
      }));

      const archive = await fileUtils.createArchive(filePaths, archivePath, 'zip');

      logger.info(`Archive created: ${archiveName} (${files.length} files)`);

      return {
        archivePath: archive.path,
        archiveName,
        fileCount: files.length,
        size: archive.size
      };
    } catch (error) {
      logger.error('Failed to create archive:', error);
      throw error;
    }
  }

  async getUserStorageStats(userId) {
    try {
      const stats = await StorageFile.findOne({
        where: { user_id: userId },
        attributes: [
          [require('sequelize').fn('COUNT', '*'), 'totalFiles'],
          [require('sequelize').fn('SUM', require('sequelize').col('file_size')), 'totalSize']
        ],
        raw: true
      });

      const fileTypeStats = await StorageFile.findAll({
        where: { user_id: userId },
        attributes: [
          'file_type',
          [require('sequelize').fn('COUNT', '*'), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('file_size')), 'size']
        ],
        group: ['file_type'],
        raw: true
      });

      return {
        totalFiles: parseInt(stats.totalFiles) || 0,
        totalSize: parseInt(stats.totalSize) || 0,
        formattedSize: fileUtils.formatBytes(stats.totalSize || 0),
        byType: fileTypeStats.reduce((acc, item) => {
          acc[item.file_type] = {
            count: parseInt(item.count),
            size: parseInt(item.size),
            formattedSize: fileUtils.formatBytes(item.size)
          };
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }

  async cleanupExpiredUploads() {
    try {
      const expiredSessions = await UploadSession.findAll({
        where: {
          status: 'active',
          expires_at: { [require('sequelize').Op.lt]: new Date() }
        }
      });

      for (const session of expiredSessions) {
        try {
          if (await fs.pathExists(session.temp_path)) {
            await fs.remove(session.temp_path);
          }
          await session.update({ status: 'expired' });
          logger.info(`Cleaned up expired upload: ${session.id}`);
        } catch (error) {
          logger.error(`Failed to cleanup upload ${session.id}:`, error);
        }
      }

      return expiredSessions.length;
    } catch (error) {
      logger.error('Failed to cleanup expired uploads:', error);
      return 0;
    }
  }
}

module.exports = new StorageService();
