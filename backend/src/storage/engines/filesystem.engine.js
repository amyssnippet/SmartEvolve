const fs = require('fs-extra');
const path = require('path');
const logger = require('../../utils/logger');

class FilesystemEngine {
  constructor(options = {}) {
    this.basePath = options.basePath || process.env.STORAGE_ROOT || '/storage';
    this.permissions = options.permissions || 0o755;
  }

  async initialize() {
    try {
      await fs.ensureDir(this.basePath);
      logger.info(`Filesystem storage initialized at: ${this.basePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize filesystem storage:', error);
      throw error;
    }
  }

  async write(relativePath, data, options = {}) {
    try {
      const fullPath = path.join(this.basePath, relativePath);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write data
      if (Buffer.isBuffer(data)) {
        await fs.writeFile(fullPath, data);
      } else if (typeof data === 'string') {
        await fs.writeFile(fullPath, data, options.encoding || 'utf8');
      } else {
        throw new Error('Unsupported data type');
      }

      // Set permissions
      await fs.chmod(fullPath, this.permissions);

      return {
        path: fullPath,
        size: (await fs.stat(fullPath)).size
      };
    } catch (error) {
      logger.error('Filesystem write failed:', error);
      throw error;
    }
  }

  async read(relativePath, options = {}) {
    try {
      const fullPath = path.join(this.basePath, relativePath);
      
      if (!(await fs.pathExists(fullPath))) {
        throw new Error('File not found');
      }

      if (options.stream) {
        return fs.createReadStream(fullPath, options);
      }

      return await fs.readFile(fullPath, options.encoding);
    } catch (error) {
      logger.error('Filesystem read failed:', error);
      throw error;
    }
  }

  async delete(relativePath) {
    try {
      const fullPath = path.join(this.basePath, relativePath);
      
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Filesystem delete failed:', error);
      throw error;
    }
  }

  async exists(relativePath) {
    try {
      const fullPath = path.join(this.basePath, relativePath);
      return await fs.pathExists(fullPath);
    } catch (error) {
      return false;
    }
  }

  async stat(relativePath) {
    try {
      const fullPath = path.join(this.basePath, relativePath);
      return await fs.stat(fullPath);
    } catch (error) {
      logger.error('Filesystem stat failed:', error);
      throw error;
    }
  }

  async move(sourcePath, destinationPath) {
    try {
      const sourceFullPath = path.join(this.basePath, sourcePath);
      const destFullPath = path.join(this.basePath, destinationPath);
      
      await fs.ensureDir(path.dirname(destFullPath));
      await fs.move(sourceFullPath, destFullPath);
      
      return true;
    } catch (error) {
      logger.error('Filesystem move failed:', error);
      throw error;
    }
  }

  async copy(sourcePath, destinationPath) {
    try {
      const sourceFullPath = path.join(this.basePath, sourcePath);
      const destFullPath = path.join(this.basePath, destinationPath);
      
      await fs.ensureDir(path.dirname(destFullPath));
      await fs.copy(sourceFullPath, destFullPath);
      
      return true;
    } catch (error) {
      logger.error('Filesystem copy failed:', error);
      throw error;
    }
  }

  async list(directory = '', options = {}) {
    try {
      const fullPath = path.join(this.basePath, directory);
      
      if (!(await fs.pathExists(fullPath))) {
        return [];
      }

      const items = await fs.readdir(fullPath);
      const results = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const stats = await fs.stat(itemPath);
        
        results.push({
          name: item,
          path: path.join(directory, item),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        });
      }

      return results;
    } catch (error) {
      logger.error('Filesystem list failed:', error);
      throw error;
    }
  }

  async getStorageStats() {
    try {
      const stats = await this.getDirectorySize(this.basePath);
      
      return {
        totalSize: stats.size,
        fileCount: stats.files,
        directoryCount: stats.directories,
        basePath: this.basePath
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    let dirCount = 0;

    async function traverse(currentPath) {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          dirCount++;
          await traverse(itemPath);
        } else {
          fileCount++;
          totalSize += stats.size;
        }
      }
    }

    if (await fs.pathExists(dirPath)) {
      await traverse(dirPath);
    }

    return {
      size: totalSize,
      files: fileCount,
      directories: dirCount
    };
  }
}

module.exports = FilesystemEngine;
