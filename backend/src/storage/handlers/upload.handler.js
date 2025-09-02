const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { StorageConfig } = require('../../config/storage');
const fileUtils = require('../../utils/fileUtils');
const logger = require('../../utils/logger');

class UploadHandler {
  async handleSingleUpload(userId, file, options = {}) {
    try {
      const {
        fileType = 'dataset',
        isPublic = false,
        projectId = null,
        metadata = {}
      } = options;

      // Validate file
      await this.validateFile(file);

      // Ensure user directories exist
      await StorageConfig.ensureUserDirectories(userId);

      // Generate safe filename
      const safeName = fileUtils.sanitizeFileName(file.originalname);
      const basePath = StorageConfig.buildFilePath(userId, fileType, safeName, isPublic);
      const finalPath = await this.ensureUniqueFilename(basePath);

      // Calculate checksum
      const checksum = await fileUtils.calculateBufferChecksum(file.buffer);

      // Write file
      await fs.writeFile(finalPath, file.buffer);

      // Get file stats
      const stats = await fs.stat(finalPath);

      return {
        path: finalPath,
        name: path.basename(finalPath),
        size: stats.size,
        checksum,
        mimeType: require('mime-types').lookup(file.originalname) || 'application/octet-stream',
        metadata: {
          ...metadata,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Single upload failed:', error);
      throw error;
    }
  }

  async handleMultipartUpload(uploadSession, chunkIndex, chunkBuffer) {
    try {
      const chunkPath = path.join(uploadSession.temp_path, `chunk_${chunkIndex}`);
      
      // Validate chunk
      if (chunkBuffer.length === 0) {
        throw new Error('Empty chunk received');
      }

      // Write chunk
      await fs.writeFile(chunkPath, chunkBuffer);

      // Verify chunk was written correctly
      const stats = await fs.stat(chunkPath);
      if (stats.size !== chunkBuffer.length) {
        throw new Error('Chunk write verification failed');
      }

      return {
        chunkIndex,
        size: stats.size,
        path: chunkPath
      };
    } catch (error) {
      logger.error('Multipart upload chunk failed:', error);
      throw error;
    }
  }

  async assembleMultipartUpload(uploadSession, finalPath) {
    try {
      const writeStream = fs.createWriteStream(finalPath);
      let totalSize = 0;

      for (let i = 0; i < uploadSession.total_chunks; i++) {
        const chunkPath = path.join(uploadSession.temp_path, `chunk_${i}`);
        
        if (!(await fs.pathExists(chunkPath))) {
          throw new Error(`Missing chunk ${i}`);
        }

        const chunkBuffer = await fs.readFile(chunkPath);
        writeStream.write(chunkBuffer);
        totalSize += chunkBuffer.length;
      }

      writeStream.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verify final file size
      if (totalSize !== uploadSession.file_size) {
        await fs.remove(finalPath);
        throw new Error(`Size mismatch: expected ${uploadSession.file_size}, got ${totalSize}`);
      }

      // Calculate final checksum
      const checksum = await fileUtils.calculateChecksum(finalPath);

      return {
        path: finalPath,
        size: totalSize,
        checksum
      };
    } catch (error) {
      logger.error('Multipart assembly failed:', error);
      throw error;
    }
  }

  async validateFile(file) {
    if (!file || !file.buffer) {
      throw new Error('No file data received');
    }

    if (file.size === 0) {
      throw new Error('Empty file not allowed');
    }

    const maxSize = parseInt(process.env.STORAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large: ${fileUtils.formatBytes(file.size)} > ${fileUtils.formatBytes(maxSize)}`);
    }

    const allowedTypes = process.env.STORAGE_ALLOWED_TYPES?.split(',') || [];
    if (allowedTypes.length > 0) {
      const extension = path.extname(file.originalname).toLowerCase().slice(1);
      if (!allowedTypes.includes(extension)) {
        throw new Error(`File type not allowed: .${extension}`);
      }
    }

    // Check for malicious files
    await this.scanForMalware(file);

    return true;
  }

  async scanForMalware(file) {
    // Basic malware scanning - in production, integrate with actual antivirus
    const buffer = file.buffer;
    const content = buffer.toString('hex').substring(0, 200);

    // Check for common malicious patterns
    const maliciousPatterns = [
      '4d5a', // PE executable header
      '7f454c46', // ELF executable header
      'cafebabe', // Java class file
      'feedface', // Mach-O binary
    ];

    for (const pattern of maliciousPatterns) {
      if (content.includes(pattern)) {
        logger.warn(`Potentially malicious file detected: ${file.originalname}`);
        // In production, you might want to quarantine or reject the file
        break;
      }
    }

    return true;
  }

  async ensureUniqueFilename(filePath, maxAttempts = 1000) {
    let counter = 0;
    let currentPath = filePath;
    
    while (await fs.pathExists(currentPath) && counter < maxAttempts) {
      counter++;
      const parsed = path.parse(filePath);
      currentPath = path.join(
        parsed.dir, 
        `${parsed.name}_${counter}${parsed.ext}`
      );
    }

    if (counter >= maxAttempts) {
      throw new Error('Could not generate unique filename');
    }
    
    return currentPath;
  }

  async cleanupTempFiles(tempPath) {
    try {
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath);
        logger.debug(`Cleaned up temp files: ${tempPath}`);
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }
  }

  async validateUploadPermissions(userId, fileType, isPublic, projectId) {
    // Check if user can upload this type of file
    // Check if user can make files public
    // Check if user has access to the project
    // Add your permission logic here

    return true;
  }

  async getUploadProgress(uploadSessionId) {
    try {
      const uploadSession = await require('../../models/UploadSession').findByPk(uploadSessionId);
      
      if (!uploadSession) {
        return null;
      }

      return {
        uploaded: uploadSession.uploaded_chunks,
        total: uploadSession.total_chunks,
        progress: Math.round((uploadSession.uploaded_chunks / uploadSession.total_chunks) * 100),
        status: uploadSession.status
      };
    } catch (error) {
      logger.error('Failed to get upload progress:', error);
      return null;
    }
  }
}

module.exports = new UploadHandler();
