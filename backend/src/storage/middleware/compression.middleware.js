const zlib = require('zlib');
const fs = require('fs-extra');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const logger = require('../../utils/logger');

const pipelineAsync = promisify(pipeline);

class CompressionMiddleware {
  constructor(options = {}) {
    this.compressionLevel = options.compressionLevel || 6;
    this.algorithm = options.algorithm || 'gzip'; // gzip, deflate, brotli
    this.minFileSize = options.minFileSize || 1024; // Don't compress files smaller than 1KB
    this.compressibleTypes = options.compressibleTypes || [
      'text/', 'application/json', 'application/xml', 'application/javascript'
    ];
    this.autoCompress = options.autoCompress || false;
  }

  isCompressible(mimeType, fileSize) {
    if (fileSize < this.minFileSize) {
      return false;
    }

    return this.compressibleTypes.some(type => 
      mimeType && mimeType.startsWith(type)
    );
  }

  createCompressionStream(algorithm = this.algorithm) {
    switch (algorithm) {
      case 'gzip':
        return zlib.createGzip({ level: this.compressionLevel });
      case 'deflate':
        return zlib.createDeflate({ level: this.compressionLevel });
      case 'brotli':
        return zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.compressionLevel
          }
        });
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  createDecompressionStream(algorithm = this.algorithm) {
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

  async compressFile(inputPath, outputPath = null, algorithm = this.algorithm) {
    try {
      if (!outputPath) {
        outputPath = `${inputPath}.${this.getExtension(algorithm)}`;
      }

      const compressionStream = this.createCompressionStream(algorithm);
      const inputStream = fs.createReadStream(inputPath);
      const outputStream = fs.createWriteStream(outputPath);

      await pipelineAsync(inputStream, compressionStream, outputStream);

      // Get compression stats
      const originalStats = await fs.stat(inputPath);
      const compressedStats = await fs.stat(outputPath);
      
      const compressionRatio = compressedStats.size / originalStats.size;
      const spaceSaved = originalStats.size - compressedStats.size;

      logger.info(`File compressed: ${path.basename(inputPath)}`, {
        originalSize: originalStats.size,
        compressedSize: compressedStats.size,
        compressionRatio: compressionRatio.toFixed(3),
        spaceSaved,
        algorithm
      });

      return {
        originalPath: inputPath,
        compressedPath: outputPath,
        originalSize: originalStats.size,
        compressedSize: compressedStats.size,
        compressionRatio,
        spaceSaved,
        algorithm
      };
    } catch (error) {
      logger.error('File compression failed:', error);
      throw error;
    }
  }

  async decompressFile(inputPath, outputPath = null, algorithm = this.algorithm) {
    try {
      if (!outputPath) {
        const ext = this.getExtension(algorithm);
        outputPath = inputPath.replace(new RegExp(`\\.${ext}$`), '');
      }

      const decompressionStream = this.createDecompressionStream(algorithm);
      const inputStream = fs.createReadStream(inputPath);
      const outputStream = fs.createWriteStream(outputPath);

      await pipelineAsync(inputStream, decompressionStream, outputStream);

      logger.info(`File decompressed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);

      return {
        compressedPath: inputPath,
        decompressedPath: outputPath,
        algorithm
      };
    } catch (error) {
      logger.error('File decompression failed:', error);
      throw error;
    }
  }

  async compressBuffer(buffer, algorithm = this.algorithm) {
    try {
      let compressedBuffer;

      switch (algorithm) {
        case 'gzip':
          compressedBuffer = await promisify(zlib.gzip)(buffer, { level: this.compressionLevel });
          break;
        case 'deflate':
          compressedBuffer = await promisify(zlib.deflate)(buffer, { level: this.compressionLevel });
          break;
        case 'brotli':
          compressedBuffer = await promisify(zlib.brotliCompress)(buffer, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: this.compressionLevel
            }
          });
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }

      return {
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: compressedBuffer.length / buffer.length,
        buffer: compressedBuffer,
        algorithm
      };
    } catch (error) {
      logger.error('Buffer compression failed:', error);
      throw error;
    }
  }

  async decompressBuffer(buffer, algorithm = this.algorithm) {
    try {
      let decompressedBuffer;

      switch (algorithm) {
        case 'gzip':
          decompressedBuffer = await promisify(zlib.gunzip)(buffer);
          break;
        case 'deflate':
          decompressedBuffer = await promisify(zlib.inflate)(buffer);
          break;
        case 'brotli':
          decompressedBuffer = await promisify(zlib.brotliDecompress)(buffer);
          break;
        default:
          throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
      }

      return {
        compressedSize: buffer.length,
        decompressedSize: decompressedBuffer.length,
        buffer: decompressedBuffer,
        algorithm
      };
    } catch (error) {
      logger.error('Buffer decompression failed:', error);
      throw error;
    }
  }

  getExtension(algorithm) {
    const extensions = {
      'gzip': 'gz',
      'deflate': 'deflate',
      'brotli': 'br'
    };
    return extensions[algorithm] || 'compressed';
  }

  async handleUploadCompression(filePath, metadata) {
    try {
      if (!this.autoCompress) {
        return { compressed: false, originalPath: filePath };
      }

      if (!this.isCompressible(metadata.mimeType, metadata.size)) {
        return { compressed: false, originalPath: filePath };
      }

      const compressedPath = `${filePath}.${this.getExtension()}`;
      const result = await this.compressFile(filePath, compressedPath);

      // Only keep compressed version if it saves significant space (>10%)
      if (result.compressionRatio > 0.9) {
        await fs.remove(compressedPath);
        return { compressed: false, originalPath: filePath };
      }

      // Remove original and keep compressed
      await fs.remove(filePath);
      
      return {
        compressed: true,
        originalPath: filePath,
        compressedPath: compressedPath,
        ...result
      };
    } catch (error) {
      logger.error('Upload compression handling failed:', error);
      return { compressed: false, originalPath: filePath };
    }
  }

  async createCompressionReport(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath);
      const report = {
        totalFiles: 0,
        compressibleFiles: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        totalSpaceSaved: 0,
        files: []
      };

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          report.totalFiles++;
          report.totalOriginalSize += stats.size;

          const mimeType = require('mime-types').lookup(filePath);
          
          if (this.isCompressible(mimeType, stats.size)) {
            report.compressibleFiles++;
            
            // Estimate compression (this is a simulation)
            const estimatedRatio = this.estimateCompressionRatio(mimeType);
            const estimatedCompressedSize = Math.round(stats.size * estimatedRatio);
            const estimatedSaved = stats.size - estimatedCompressedSize;
            
            report.totalCompressedSize += estimatedCompressedSize;
            report.totalSpaceSaved += estimatedSaved;
            
            report.files.push({
              name: file,
              originalSize: stats.size,
              estimatedCompressedSize,
              estimatedSaved,
              compressionRatio: estimatedRatio,
              mimeType
            });
          } else {
            report.totalCompressedSize += stats.size;
          }
        }
      }

      report.overallCompressionRatio = report.totalCompressedSize / report.totalOriginalSize;
      report.spaceSavingPercentage = (report.totalSpaceSaved / report.totalOriginalSize) * 100;

      return report;
    } catch (error) {
      logger.error('Compression report generation failed:', error);
      throw error;
    }
  }

  estimateCompressionRatio(mimeType) {
    // Rough estimates based on file types
    const ratios = {
      'text/': 0.3,
      'application/json': 0.2,
      'application/xml': 0.3,
      'application/javascript': 0.4,
      'text/css': 0.4,
      'text/html': 0.3
    };

    for (const [type, ratio] of Object.entries(ratios)) {
      if (mimeType && mimeType.startsWith(type)) {
        return ratio;
      }
    }

    return 0.6; // Default conservative estimate
  }
}

module.exports = CompressionMiddleware;
