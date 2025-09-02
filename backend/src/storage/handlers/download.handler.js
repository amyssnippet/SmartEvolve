const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const logger = require('../../utils/logger');

class DownloadHandler {
  async handleSingleDownload(storageFile, options = {}) {
    try {
      const { range } = options;

      if (!(await fs.pathExists(storageFile.file_path))) {
        throw new Error('File not found on disk');
      }

      const stats = await fs.stat(storageFile.file_path);
      
      // Handle range requests for large files
      if (range) {
        return await this.handleRangeDownload(storageFile, range, stats);
      }

      // Regular download
      return {
        stream: fs.createReadStream(storageFile.file_path),
        size: stats.size,
        mimeType: storageFile.mime_type,
        fileName: storageFile.file_name,
        headers: {
          'Content-Length': stats.size,
          'Content-Type': storageFile.mime_type,
          'Content-Disposition': `attachment; filename="${storageFile.file_name}"`,
          'Last-Modified': stats.mtime.toUTCString(),
          'ETag': `"${stats.mtime.getTime()}-${stats.size}"`
        }
      };
    } catch (error) {
      logger.error('Single download failed:', error);
      throw error;
    }
  }

  async handleRangeDownload(storageFile, rangeHeader, stats) {
    try {
      const ranges = this.parseRangeHeader(rangeHeader, stats.size);
      
      if (ranges.length !== 1) {
        throw new Error('Multiple ranges not supported');
      }

      const range = ranges[0];
      const stream = fs.createReadStream(storageFile.file_path, {
        start: range.start,
        end: range.end
      });

      return {
        stream,
        size: range.end - range.start + 1,
        mimeType: storageFile.mime_type,
        fileName: storageFile.file_name,
        statusCode: 206,
        headers: {
          'Content-Range': `bytes ${range.start}-${range.end}/${stats.size}`,
          'Content-Length': range.end - range.start + 1,
          'Content-Type': storageFile.mime_type,
          'Accept-Ranges': 'bytes'
        }
      };
    } catch (error) {
      logger.error('Range download failed:', error);
      throw error;
    }
  }

  parseRangeHeader(rangeHeader, fileSize) {
    const ranges = [];
    const rangeMatch = rangeHeader.match(/bytes=(.+)/);
    
    if (!rangeMatch) {
      throw new Error('Invalid range header');
    }

    const rangeSpecs = rangeMatch[1].split(',');
    
    for (const spec of rangeSpecs) {
      const [startStr, endStr] = spec.trim().split('-');
      
      let start = startStr ? parseInt(startStr) : 0;
      let end = endStr ? parseInt(endStr) : fileSize - 1;
      
      if (start < 0) start = Math.max(0, fileSize + start);
      if (end >= fileSize) end = fileSize - 1;
      if (start > end) continue;
      
      ranges.push({ start, end });
    }

    return ranges;
  }

  async handleBulkDownload(storageFiles, options = {}) {
    try {
      const { format = 'zip', compressionLevel = 6 } = options;
      
      if (storageFiles.length === 0) {
        throw new Error('No files to download');
      }

      const archiveName = `download_${Date.now()}.${format}`;
      const tempPath = path.join(
        require('../../config/storage').STORAGE_PATHS.TEMP_UPLOADS,
        archiveName
      );

      await this.createArchive(storageFiles, tempPath, format, compressionLevel);

      const stats = await fs.stat(tempPath);

      return {
        stream: fs.createReadStream(tempPath),
        size: stats.size,
        mimeType: format === 'zip' ? 'application/zip' : 'application/x-tar',
        fileName: archiveName,
        tempFile: tempPath, // For cleanup after download
        headers: {
          'Content-Length': stats.size,
          'Content-Type': format === 'zip' ? 'application/zip' : 'application/x-tar',
          'Content-Disposition': `attachment; filename="${archiveName}"`
        }
      };
    } catch (error) {
      logger.error('Bulk download failed:', error);
      throw error;
    }
  }

  async createArchive(storageFiles, outputPath, format, compressionLevel) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver(format, {
        zlib: { level: compressionLevel }
      });

      output.on('close', () => {
        logger.info(`Archive created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Add files to archive
      storageFiles.forEach(file => {
        if (fs.pathExistsSync(file.file_path)) {
          archive.file(file.file_path, { name: file.file_name });
        } else {
          logger.warn(`File not found for archive: ${file.file_path}`);
        }
      });

      archive.finalize();
    });
  }

  async generatePresignedUrl(storageFile, expiresInSeconds = 3600) {
    try {
      // Generate a temporary signed URL for direct downloads
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiry = Date.now() + (expiresInSeconds * 1000);
      
      // Store in Redis for verification
      const redis = require('../../config/redis').getRedisClient();
      await redis.setEx(`download_token:${token}`, expiresInSeconds, JSON.stringify({
        fileId: storageFile.id,
        userId: storageFile.user_id,
        expiry
      }));

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
      return `${baseUrl}/api/storage/download/${storageFile.id}?token=${token}`;
    } catch (error) {
      logger.error('Failed to generate presigned URL:', error);
      throw error;
    }
  }

  async verifyDownloadToken(token, fileId) {
    try {
      const redis = require('../../config/redis').getRedisClient();
      const tokenData = await redis.get(`download_token:${token}`);
      
      if (!tokenData) {
        throw new Error('Invalid or expired download token');
      }

      const data = JSON.parse(tokenData);
      
      if (data.fileId !== fileId || data.expiry < Date.now()) {
        throw new Error('Invalid or expired download token');
      }

      return data;
    } catch (error) {
      logger.error('Failed to verify download token:', error);
      throw error;
    }
  }

  async trackDownload(storageFile, userId, ipAddress) {
    try {
      // Increment download counter
      await storageFile.increment('download_count');
      
      // Log download for analytics
      logger.info(`File downloaded: ${storageFile.file_name} by user ${userId} from ${ipAddress}`);
      
      // Could also store in separate downloads table for detailed analytics
    } catch (error) {
      logger.error('Failed to track download:', error);
    }
  }

  async cleanupTempDownload(tempFilePath) {
    try {
      if (await fs.pathExists(tempFilePath)) {
        await fs.remove(tempFilePath);
        logger.debug(`Cleaned up temp download: ${tempFilePath}`);
      }
    } catch (error) {
      logger.error('Failed to cleanup temp download:', error);
    }
  }

  validateDownloadPermissions(storageFile, user) {
    // Public files can be downloaded by anyone
    if (storageFile.access_level === 'public') {
      return true;
    }

    // Private files only by owner
    if (storageFile.access_level === 'private') {
      return user && user.id === storageFile.user_id;
    }

    // Shared files - implement sharing logic here
    if (storageFile.access_level === 'shared') {
      // Check if user has access to the project or file sharing
      return user && (
        user.id === storageFile.user_id ||
        this.checkSharedAccess(storageFile, user)
      );
    }

    return false;
  }

  checkSharedAccess(storageFile, user) {
    // Implement your sharing logic here
    // This could check project membership, sharing links, etc.
    return false;
  }
}

module.exports = new DownloadHandler();
