const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const crypto = require('crypto');
const mime = require('mime-types');
const logger = require('./logger');

class FileUtils {
  static async ensureDirectory(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      logger.error('Failed to ensure directory:', error);
      throw error;
    }
  }

  static async calculateChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static async calculateBufferChecksum(buffer, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(buffer);
    return hash.digest('hex');
  }

  static async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        mimeType,
        extension: path.extname(filePath).toLowerCase()
      };
    } catch (error) {
      logger.error('Failed to get file stats:', error);
      throw error;
    }
  }

  static async moveFile(sourcePath, destinationPath) {
    try {
      await fs.ensureDir(path.dirname(destinationPath));
      await fs.move(sourcePath, destinationPath);
      return true;
    } catch (error) {
      logger.error('Failed to move file:', error);
      throw error;
    }
  }

  static async copyFile(sourcePath, destinationPath) {
    try {
      await fs.ensureDir(path.dirname(destinationPath));
      await fs.copy(sourcePath, destinationPath);
      return true;
    } catch (error) {
      logger.error('Failed to copy file:', error);
      throw error;
    }
  }

  static async deleteFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  static async createArchive(filePaths, outputPath, format = 'zip') {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver(format, {
        zlib: { level: 9 }
      });

      output.on('close', () => {
        resolve({
          path: outputPath,
          size: archive.pointer()
        });
      });

      archive.on('error', reject);
      archive.pipe(output);

      filePaths.forEach(({ filePath, name }) => {
        archive.file(filePath, { name: name || path.basename(filePath) });
      });

      archive.finalize();
    });
  }

  static async extractArchive(archivePath, outputPath) {
    try {
      await fs.ensureDir(outputPath);
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(archivePath)
          .pipe(unzipper.Extract({ path: outputPath }))
          .on('close', resolve)
          .on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to extract archive:', error);
      throw error;
    }
  }

  static async getDirectorySize(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      
      if (stats.isFile()) {
        return stats.size;
      }
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          totalSize += await this.getDirectorySize(filePath);
        }
        
        return totalSize;
      }
      
      return 0;
    } catch (error) {
      logger.error('Failed to get directory size:', error);
      return 0;
    }
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static isValidFileName(fileName) {
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return false;
    }
    
    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const nameWithoutExt = path.parse(fileName).name;
    if (reservedNames.test(nameWithoutExt)) {
      return false;
    }
    
    // Check length
    if (fileName.length > 255) {
      return false;
    }
    
    return true;
  }

  static sanitizeFileName(fileName) {
    // Replace invalid characters
    const sanitized = fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
    
    // Ensure it's not too long
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.parse(sanitized).name;
      return nameWithoutExt.substring(0, 255 - ext.length) + ext;
    }
    
    return sanitized;
  }

  static async streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  static async writeBufferToFile(buffer, filePath) {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, buffer);
      return true;
    } catch (error) {
      logger.error('Failed to write buffer to file:', error);
      throw error;
    }
  }

  static getFileExtension(fileName) {
    return path.extname(fileName).toLowerCase().slice(1);
  }

  static isAllowedFileType(fileName, allowedTypes = []) {
    const extension = this.getFileExtension(fileName);
    return allowedTypes.length === 0 || allowedTypes.includes(extension);
  }
}

module.exports = FileUtils;
