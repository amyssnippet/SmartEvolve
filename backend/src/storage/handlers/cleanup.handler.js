const fs = require('fs-extra');
const path = require('path');
const { StorageConfig } = require('../../config/storage');
const StorageFile = require('../../models/StorageFile');
const UploadSession = require('../../models/UploadSession');
const fileUtils = require('../../utils/fileUtils');
const logger = require('../../utils/logger');

class CleanupHandler {
  async cleanupExpiredUploads() {
    try {
      logger.info('Starting expired uploads cleanup');
      
      const expiredSessions = await UploadSession.findAll({
        where: {
          status: 'active',
          expires_at: { [require('sequelize').Op.lt]: new Date() }
        }
      });

      let cleanedCount = 0;

      for (const session of expiredSessions) {
        try {
          // Remove temp files
          if (await fs.pathExists(session.temp_path)) {
            await fs.remove(session.temp_path);
          }

          // Update session status
          await session.update({ status: 'expired' });
          cleanedCount++;

          logger.debug(`Cleaned expired upload session: ${session.id}`);
        } catch (error) {
          logger.error(`Failed to cleanup session ${session.id}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired upload sessions`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired uploads:', error);
      throw error;
    }
  }

  async cleanupOrphanedFiles() {
    try {
      logger.info('Starting orphaned files cleanup');
      
      const orphanedFiles = await StorageFile.findAll({
        where: {
          status: 'deleted'
        }
      });

      let cleanedCount = 0;

      for (const file of orphanedFiles) {
        try {
          // Remove physical file
          if (await fs.pathExists(file.file_path)) {
            await fs.remove(file.file_path);
          }

          // Remove database record
          await file.destroy();
          cleanedCount++;

          logger.debug(`Cleaned orphaned file: ${file.file_name}`);
        } catch (error) {
          logger.error(`Failed to cleanup file ${file.id}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedCount} orphaned files`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
      throw error;
    }
  }

  async cleanupTempFiles() {
    try {
      logger.info('Starting temp files cleanup');
      
      const tempDir = StorageConfig.STORAGE_PATHS.TEMP_UPLOADS;
      
      if (!(await fs.pathExists(tempDir))) {
        return 0;
      }

      const files = await fs.readdir(tempDir);
      let cleanedCount = 0;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          
          const age = Date.now() - stats.mtime.getTime();
          
          if (age > maxAge) {
            await fs.remove(filePath);
            cleanedCount++;
            logger.debug(`Cleaned temp file: ${file}`);
          }
        } catch (error) {
          logger.error(`Failed to cleanup temp file ${file}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedCount} temp files`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
      throw error;
    }
  }

  async cleanupEmptyDirectories() {
    try {
      logger.info('Starting empty directories cleanup');
      
      const usersDir = StorageConfig.STORAGE_PATHS.USERS_ROOT;
      let cleanedCount = 0;

      if (await fs.pathExists(usersDir)) {
        cleanedCount += await this.removeEmptyDirsRecursive(usersDir);
      }

      logger.info(`Cleaned up ${cleanedCount} empty directories`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup empty directories:', error);
      throw error;
    }
  }

  async removeEmptyDirsRecursive(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      
      if (!stats.isDirectory()) {
        return 0;
      }

      const files = await fs.readdir(dirPath);
      let cleanedCount = 0;

      // Recursively check subdirectories
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const fileStats = await fs.stat(fullPath);
        
        if (fileStats.isDirectory()) {
          cleanedCount += await this.removeEmptyDirsRecursive(fullPath);
        }
      }

      // Check if directory is now empty
      const updatedFiles = await fs.readdir(dirPath);
      
      if (updatedFiles.length === 0 && dirPath !== StorageConfig.STORAGE_PATHS.USERS_ROOT) {
        await fs.rmdir(dirPath);
        cleanedCount++;
        logger.debug(`Removed empty directory: ${dirPath}`);
      }

      return cleanedCount;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to process directory ${dirPath}:`, error);
      }
      return 0;
    }
  }

  async generateStorageReport() {
    try {
      logger.info('Generating storage report');
      
      const usersDir = StorageConfig.STORAGE_PATHS.USERS_ROOT;
      const openSourceModels = StorageConfig.STORAGE_PATHS.OPEN_SOURCE_MODELS;
      const openSourceDatasets = StorageConfig.STORAGE_PATHS.OPEN_SOURCE_DATASETS;
      const tempDir = StorageConfig.STORAGE_PATHS.TEMP_UPLOADS;

      const report = {
        timestamp: new Date().toISOString(),
        directories: {},
        totalSize: 0,
        totalFiles: 0,
        databaseStats: {}
      };

      // Analyze each directory
      if (await fs.pathExists(usersDir)) {
        report.directories.users = await this.analyzeDirectory(usersDir);
      }

      if (await fs.pathExists(openSourceModels)) {
        report.directories.openSourceModels = await this.analyzeDirectory(openSourceModels);
      }

      if (await fs.pathExists(openSourceDatasets)) {
        report.directories.openSourceDatasets = await this.analyzeDirectory(openSourceDatasets);
      }

      if (await fs.pathExists(tempDir)) {
        report.directories.temp = await this.analyzeDirectory(tempDir);
      }

      // Calculate totals
      Object.values(report.directories).forEach(dir => {
        report.totalSize += dir.size;
        report.totalFiles += dir.fileCount;
      });

      // Database statistics
      report.databaseStats = {
        totalStorageFiles: await StorageFile.count(),
        activeUploadSessions: await UploadSession.count({ where: { status: 'active' } }),
        expiredUploadSessions: await UploadSession.count({ where: { status: 'expired' } })
      };

      // Format sizes
      report.formattedTotalSize = fileUtils.formatBytes(report.totalSize);
      Object.keys(report.directories).forEach(key => {
        report.directories[key].formattedSize = fileUtils.formatBytes(report.directories[key].size);
      });

      logger.info(`Storage report generated: ${report.formattedTotalSize} total, ${report.totalFiles} files`);
      
      return report;
    } catch (error) {
      logger.error('Failed to generate storage report:', error);
      throw error;
    }
  }

  async analyzeDirectory(dirPath) {
    try {
      let size = 0;
      let fileCount = 0;
      let dirCount = 0;

      const analyze = async (currentPath) => {
        const items = await fs.readdir(currentPath);
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            dirCount++;
            await analyze(itemPath);
          } else {
            fileCount++;
            size += stats.size;
          }
        }
      };

      if (await fs.pathExists(dirPath)) {
        await analyze(dirPath);
      }

      return {
        path: dirPath,
        size,
        fileCount,
        dirCount
      };
    } catch (error) {
      logger.error(`Failed to analyze directory ${dirPath}:`, error);
      return {
        path: dirPath,
        size: 0,
        fileCount: 0,
        dirCount: 0,
        error: error.message
      };
    }
  }

  async performFullCleanup() {
    try {
      logger.info('Starting full storage cleanup');
      
      const results = {
        expiredUploads: await this.cleanupExpiredUploads(),
        orphanedFiles: await this.cleanupOrphanedFiles(),
        tempFiles: await this.cleanupTempFiles(),
        emptyDirectories: await this.cleanupEmptyDirectories()
      };

      const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);
      
      logger.info(`Full cleanup completed: ${totalCleaned} items cleaned`);
      
      return {
        ...results,
        totalCleaned,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Full cleanup failed:', error);
      throw error;
    }
  }

  async scheduleCleanup() {
    // This would be called by a cron job or scheduled task
    try {
      logger.info('Running scheduled cleanup');
      
      const result = await this.performFullCleanup();
      const report = await this.generateStorageReport();
      
      // Could send the report via email or store in database
      logger.info('Scheduled cleanup completed', { result, report });
      
      return { cleanup: result, report };
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = new CleanupHandler();
