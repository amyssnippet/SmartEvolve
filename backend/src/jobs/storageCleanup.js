const storageService = require('../services/storageService');
const cleanupHandler = require('../storage/handlers/cleanup.handler');
const logger = require('../utils/logger');

module.exports = async function storageCleanup(job) {
  try {
    logger.info('Starting storage cleanup job');
    
    const results = {
      expiredUploads: 0,
      orphanedFiles: 0,
      tempFiles: 0,
      emptyDirectories: 0,
      totalCleaned: 0
    };

    // Clean up expired upload sessions
    try {
      const expiredCount = await cleanupHandler.cleanupExpiredUploads();
      results.expiredUploads = expiredCount;
      logger.info(`Cleaned ${expiredCount} expired upload sessions`);
    } catch (error) {
      logger.error('Failed to cleanup expired uploads:', error);
    }

    // Clean up orphaned files
    try {
      const orphanedCount = await cleanupHandler.cleanupOrphanedFiles();
      results.orphanedFiles = orphanedCount;
      logger.info(`Cleaned ${orphanedCount} orphaned files`);
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
    }

    // Clean up temp files
    try {
      const tempCount = await cleanupHandler.cleanupTempFiles();
      results.tempFiles = tempCount;
      logger.info(`Cleaned ${tempCount} temp files`);
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }

    // Clean up empty directories
    try {
      const dirCount = await cleanupHandler.cleanupEmptyDirectories();
      results.emptyDirectories = dirCount;
      logger.info(`Cleaned ${dirCount} empty directories`);
    } catch (error) {
      logger.error('Failed to cleanup empty directories:', error);
    }

    results.totalCleaned = results.expiredUploads + results.orphanedFiles + results.tempFiles + results.emptyDirectories;

    logger.info('Storage cleanup completed', {
      results,
      duration: job.processedOn ? Date.now() - job.processedOn : 0
    });

    return results;
  } catch (error) {
    logger.error('Storage cleanup job failed:', error);
    throw error;
  }
};
