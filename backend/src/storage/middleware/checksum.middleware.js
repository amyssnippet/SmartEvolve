const crypto = require('crypto');
const fs = require('fs-extra');
const logger = require('../../utils/logger');

class ChecksumMiddleware {
  constructor(options = {}) {
    this.algorithms = options.algorithms || ['sha256', 'md5'];
    this.verifyOnRead = options.verifyOnRead || false;
    this.updateOnWrite = options.updateOnWrite || true;
    this.checksumStorage = options.checksumStorage || 'sidecar'; // 'sidecar', 'database', 'metadata'
  }

  async calculateChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async calculateBufferChecksum(buffer, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(buffer);
    return hash.digest('hex');
  }

  async calculateMultipleChecksums(filePath, algorithms = this.algorithms) {
    const checksums = {};
    
    return new Promise((resolve, reject) => {
      const hashes = {};
      algorithms.forEach(alg => {
        hashes[alg] = crypto.createHash(alg);
      });

      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => {
        algorithms.forEach(alg => {
          hashes[alg].update(data);
        });
      });
      
      stream.on('end', () => {
        algorithms.forEach(alg => {
          checksums[alg] = hashes[alg].digest('hex');
        });
        resolve(checksums);
      });
      
      stream.on('error', reject);
    });
  }

  async storeChecksums(filePath, checksums) {
    try {
      switch (this.checksumStorage) {
        case 'sidecar':
          await this.storeSidecarChecksums(filePath, checksums);
          break;
        case 'database':
          await this.storeDatabaseChecksums(filePath, checksums);
          break;
        case 'metadata':
          await this.storeMetadataChecksums(filePath, checksums);
          break;
        default:
          throw new Error(`Unsupported checksum storage: ${this.checksumStorage}`);
      }
    } catch (error) {
      logger.error('Failed to store checksums:', error);
      throw error;
    }
  }

  async storeSidecarChecksums(filePath, checksums) {
    const checksumPath = `${filePath}.checksums`;
    const checksumData = {
      file: require('path').basename(filePath),
      algorithms: Object.keys(checksums),
      checksums,
      createdAt: new Date().toISOString()
    };
    
    await fs.writeJSON(checksumPath, checksumData, { spaces: 2 });
  }

  async storeDatabaseChecksums(filePath, checksums) {
    // Implementation would depend on your database structure
    // This is a placeholder for database storage
    const StorageFile = require('../../models/StorageFile');
    
    try {
      await StorageFile.update(
        { checksum: checksums.sha256 }, // Store primary checksum
        { where: { file_path: filePath } }
      );
    } catch (error) {
      logger.error('Database checksum storage failed:', error);
    }
  }

  async storeMetadataChecksums(filePath, checksums) {
    const metadataPath = `${filePath}.meta`;
    let metadata = {};
    
    if (await fs.pathExists(metadataPath)) {
      metadata = await fs.readJSON(metadataPath);
    }
    
    metadata.checksums = checksums;
    metadata.checksumUpdatedAt = new Date().toISOString();
    
    await fs.writeJSON(metadataPath, metadata, { spaces: 2 });
  }

  async loadChecksums(filePath) {
    try {
      switch (this.checksumStorage) {
        case 'sidecar':
          return await this.loadSidecarChecksums(filePath);
        case 'database':
          return await this.loadDatabaseChecksums(filePath);
        case 'metadata':
          return await this.loadMetadataChecksums(filePath);
        default:
          throw new Error(`Unsupported checksum storage: ${this.checksumStorage}`);
      }
    } catch (error) {
      logger.error('Failed to load checksums:', error);
      return null;
    }
  }

  async loadSidecarChecksums(filePath) {
    const checksumPath = `${filePath}.checksums`;
    
    if (await fs.pathExists(checksumPath)) {
      const data = await fs.readJSON(checksumPath);
      return data.checksums;
    }
    
    return null;
  }

  async loadDatabaseChecksums(filePath) {
    const StorageFile = require('../../models/StorageFile');
    
    try {
      const file = await StorageFile.findOne({
        where: { file_path: filePath }
      });
      
      if (file && file.checksum) {
        return { sha256: file.checksum };
      }
    } catch (error) {
      logger.error('Database checksum loading failed:', error);
    }
    
    return null;
  }

  async loadMetadataChecksums(filePath) {
    const metadataPath = `${filePath}.meta`;
    
    if (await fs.pathExists(metadataPath)) {
      const metadata = await fs.readJSON(metadataPath);
      return metadata.checksums || null;
    }
    
    return null;
  }

  async verifyFile(filePath, expectedChecksums = null) {
    try {
      if (!expectedChecksums) {
        expectedChecksums = await this.loadChecksums(filePath);
      }
      
      if (!expectedChecksums) {
        return {
          verified: false,
          reason: 'No checksums available for verification'
        };
      }

      const algorithms = Object.keys(expectedChecksums);
      const actualChecksums = await this.calculateMultipleChecksums(filePath, algorithms);
      
      const results = {};
      let allMatch = true;
      
      for (const algorithm of algorithms) {
        const matches = actualChecksums[algorithm] === expectedChecksums[algorithm];
        results[algorithm] = {
          expected: expectedChecksums[algorithm],
          actual: actualChecksums[algorithm],
          matches
        };
        
        if (!matches) {
          allMatch = false;
        }
      }

      return {
        verified: allMatch,
        results,
        algorithms
      };
    } catch (error) {
      logger.error('File verification failed:', error);
      return {
        verified: false,
        reason: error.message
      };
    }
  }

  async handleFileWrite(filePath, data) {
    try {
      // Write the file first
      if (Buffer.isBuffer(data)) {
        await fs.writeFile(filePath, data);
      } else {
        // Assume it's already written, just calculate checksums
      }

      if (this.updateOnWrite) {
        const checksums = await this.calculateMultipleChecksums(filePath, this.algorithms);
        await this.storeChecksums(filePath, checksums);
        
        logger.debug(`Checksums calculated for ${filePath}:`, checksums);
        
        return {
          filePath,
          checksums,
          algorithms: this.algorithms
        };
      }

      return { filePath };
    } catch (error) {
      logger.error('File write with checksum failed:', error);
      throw error;
    }
  }

  async handleFileRead(filePath) {
    try {
      const data = await fs.readFile(filePath);
      
      if (this.verifyOnRead) {
        const verification = await this.verifyFile(filePath);
        
        if (!verification.verified) {
          const error = new Error(`File integrity check failed: ${verification.reason}`);
          error.verification = verification;
          throw error;
        }
        
        logger.debug(`File integrity verified for ${filePath}`);
        
        return {
          data,
          verified: true,
          verification
        };
      }

      return { data };
    } catch (error) {
      logger.error('File read with verification failed:', error);
      throw error;
    }
  }

  async repairFile(filePath, backupSources = []) {
    try {
      logger.info(`Attempting to repair corrupted file: ${filePath}`);
      
      // Try to find a valid backup
      for (const backupPath of backupSources) {
        if (await fs.pathExists(backupPath)) {
          const verification = await this.verifyFile(backupPath);
          
          if (verification.verified) {
            // Copy backup to original location
            await fs.copy(backupPath, filePath);
            
            // Verify the repair
            const repairVerification = await this.verifyFile(filePath);
            
            if (repairVerification.verified) {
              logger.info(`File successfully repaired from backup: ${backupPath}`);
              return {
                repaired: true,
                source: backupPath,
                verification: repairVerification
              };
            }
          }
        }
      }

      return {
        repaired: false,
        reason: 'No valid backup sources found'
      };
    } catch (error) {
      logger.error('File repair failed:', error);
      return {
        repaired: false,
        reason: error.message
      };
    }
  }

  async auditDirectory(directoryPath) {
    try {
      const files = await this.getFilesRecursively(directoryPath);
      const auditResults = {
        totalFiles: files.length,
        verifiedFiles: 0,
        corruptedFiles: 0,
        missingChecksums: 0,
        results: []
      };

      for (const filePath of files) {
        try {
          const storedChecksums = await this.loadChecksums(filePath);
          
          if (!storedChecksums) {
            auditResults.missingChecksums++;
            auditResults.results.push({
              file: filePath,
              status: 'missing_checksums'
            });
            continue;
          }

          const verification = await this.verifyFile(filePath, storedChecksums);
          
          if (verification.verified) {
            auditResults.verifiedFiles++;
            auditResults.results.push({
              file: filePath,
              status: 'verified',
              algorithms: verification.algorithms
            });
          } else {
            auditResults.corruptedFiles++;
            auditResults.results.push({
              file: filePath,
              status: 'corrupted',
              verification
            });
          }
        } catch (error) {
          auditResults.results.push({
            file: filePath,
            status: 'error',
            error: error.message
          });
        }
      }

      return auditResults;
    } catch (error) {
      logger.error('Directory audit failed:', error);
      throw error;
    }
  }

  async getFilesRecursively(directoryPath) {
    const files = [];
    
    async function traverse(currentPath) {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = require('path').join(currentPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await traverse(itemPath);
        } else if (stats.isFile() && !item.endsWith('.checksums') && !item.endsWith('.meta')) {
          files.push(itemPath);
        }
      }
    }

    await traverse(directoryPath);
    return files;
  }
}

module.exports = ChecksumMiddleware;
