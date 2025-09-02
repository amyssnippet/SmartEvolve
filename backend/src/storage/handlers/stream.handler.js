const fs = require('fs-extra');
const { Transform } = require('stream');
const logger = require('../../utils/logger');

class StreamHandler {
  async createReadStream(filePath, options = {}) {
    try {
      const { start, end, highWaterMark = 64 * 1024 } = options;

      if (!(await fs.pathExists(filePath))) {
        throw new Error('File not found');
      }

      const streamOptions = { highWaterMark };
      if (start !== undefined) streamOptions.start = start;
      if (end !== undefined) streamOptions.end = end;

      return fs.createReadStream(filePath, streamOptions);
    } catch (error) {
      logger.error('Failed to create read stream:', error);
      throw error;
    }
  }

  async createWriteStream(filePath, options = {}) {
    try {
      const { highWaterMark = 64 * 1024, flags = 'w' } = options;

      // Ensure directory exists
      await fs.ensureDir(require('path').dirname(filePath));

      return fs.createWriteStream(filePath, { 
        highWaterMark,
        flags
      });
    } catch (error) {
      logger.error('Failed to create write stream:', error);
      throw error;
    }
  }

  createProgressStream(totalSize, onProgress) {
    let bytesProcessed = 0;

    return new Transform({
      transform(chunk, encoding, callback) {
        bytesProcessed += chunk.length;
        const progress = Math.round((bytesProcessed / totalSize) * 100);
        
        if (onProgress) {
          onProgress({
            bytesProcessed,
            totalSize,
            progress
          });
        }

        callback(null, chunk);
      }
    });
  }

  createCompressionStream(algorithm = 'gzip') {
    const zlib = require('zlib');
    
    switch (algorithm) {
      case 'gzip':
        return zlib.createGzip();
      case 'deflate':
        return zlib.createDeflate();
      case 'brotli':
        return zlib.createBrotliCompress();
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  createDecompressionStream(algorithm = 'gzip') {
    const zlib = require('zlib');
    
    switch (algorithm) {
      case 'gzip':
        return zlib.createGunzip();
      case 'deflate':
        return zlib.createInflate();
      case 'brotli':
        return zlib.createBrotliDecompress();
      default:
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
    }
  }

  createEncryptionStream(algorithm = 'aes-256-cbc', key, iv) {
    const crypto = require('crypto');
    return crypto.createCipher(algorithm, key, iv);
  }

  createDecryptionStream(algorithm = 'aes-256-cbc', key, iv) {
    const crypto = require('crypto');
    return crypto.createDecipher(algorithm, key, iv);
  }

  createHashStream(algorithm = 'sha256') {
    const crypto = require('crypto');
    const hash = crypto.createHash(algorithm);
    
    return new Transform({
      transform(chunk, encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        this.hash = hash.digest('hex');
        callback();
      }
    });
  }

  async pipelineStreams(streams) {
    return new Promise((resolve, reject) => {
      const { pipeline } = require('stream');
      
      pipeline(streams, (error) => {
        if (error) {
          logger.error('Stream pipeline failed:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async streamToBuffer(stream, maxSize = 100 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;

      stream.on('data', (chunk) => {
        size += chunk.length;
        
        if (size > maxSize) {
          return reject(new Error('Stream size exceeds maximum allowed size'));
        }
        
        chunks.push(chunk);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', reject);
    });
  }

  async copyStream(source, destination, options = {}) {
    const { 
      transform,
      onProgress,
      totalSize,
      verifyChecksum = false 
    } = options;

    try {
      const streams = [source];

      // Add progress tracking if requested
      if (onProgress && totalSize) {
        streams.push(this.createProgressStream(totalSize, onProgress));
      }

      // Add transform stream if provided
      if (transform) {
        streams.push(transform);
      }

      // Add checksum verification if requested
      let hashStream;
      if (verifyChecksum) {
        hashStream = this.createHashStream();
        streams.push(hashStream);
      }

      // Add destination
      streams.push(destination);

      // Execute pipeline
      await this.pipelineStreams(streams);

      // Return checksum if calculated
      if (hashStream) {
        return hashStream.hash;
      }

      return null;
    } catch (error) {
      logger.error('Stream copy failed:', error);
      throw error;
    }
  }

  createThrottleStream(bytesPerSecond) {
    let lastTime = Date.now();
    let bytesTransferred = 0;

    return new Transform({
      transform(chunk, encoding, callback) {
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        bytesTransferred += chunk.length;

        const expectedTime = bytesTransferred / bytesPerSecond;
        const delay = Math.max(0, (expectedTime - elapsed) * 1000);

        setTimeout(() => {
          callback(null, chunk);
        }, delay);

        lastTime = now;
      }
    });
  }

  async streamFileChunks(filePath, chunkSize = 1024 * 1024, onChunk) {
    try {
      const stats = await fs.stat(filePath);
      const totalSize = stats.size;
      let bytesRead = 0;

      const stream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

      return new Promise((resolve, reject) => {
        stream.on('data', async (chunk) => {
          try {
            bytesRead += chunk.length;
            const progress = Math.round((bytesRead / totalSize) * 100);
            
            if (onChunk) {
              await onChunk(chunk, {
                bytesRead,
                totalSize,
                progress,
                isLast: bytesRead >= totalSize
              });
            }
          } catch (error) {
            reject(error);
          }
        });

        stream.on('end', () => resolve({ totalSize, bytesRead }));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to stream file chunks:', error);
      throw error;
    }
  }
}

module.exports = new StreamHandler();
