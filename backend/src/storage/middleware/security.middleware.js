const crypto = require('crypto');
const logger = require('../../utils/logger');

class SecurityMiddleware {
  constructor(options = {}) {
    this.virusScanEnabled = options.virusScanEnabled || false;
    this.quarantinePath = options.quarantinePath || '/quarantine';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024 * 1024; // 10GB
    this.allowedMimeTypes = options.allowedMimeTypes || [];
    this.bannedExtensions = options.bannedExtensions || [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'
    ];
  }

  async scanFile(filePath, metadata = {}) {
    try {
      const results = {
        safe: true,
        threats: [],
        warnings: [],
        actions: []
      };

      // File size validation
      if (metadata.size > this.maxFileSize) {
        results.safe = false;
        results.threats.push({
          type: 'size_exceeded',
          message: `File size ${metadata.size} exceeds maximum allowed ${this.maxFileSize}`,
          severity: 'high'
        });
      }

      // Extension validation
      const extension = require('path').extname(metadata.name || '').toLowerCase();
      if (this.bannedExtensions.includes(extension)) {
        results.safe = false;
        results.threats.push({
          type: 'banned_extension',
          message: `File extension ${extension} is not allowed`,
          severity: 'high'
        });
      }

      // MIME type validation
      if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(metadata.mimeType)) {
        results.warnings.push({
          type: 'mime_type_mismatch',
          message: `MIME type ${metadata.mimeType} not in allowed list`,
          severity: 'medium'
        });
      }

      // Content-based scanning
      await this.scanFileContent(filePath, results);

      // Virus scanning (if enabled)
      if (this.virusScanEnabled) {
        await this.performVirusScan(filePath, results);
      }

      return results;
    } catch (error) {
      logger.error('File security scan failed:', error);
      return {
        safe: false,
        threats: [{
          type: 'scan_error',
          message: error.message,
          severity: 'high'
        }],
        warnings: [],
        actions: []
      };
    }
  }

  async scanFileContent(filePath, results) {
    try {
      const fs = require('fs-extra');
      const buffer = await fs.readFile(filePath);
      const content = buffer.toString('hex', 0, Math.min(buffer.length, 1024)); // First 1KB

      // Check for executable signatures
      const executableSignatures = {
        '4d5a': 'PE Executable',
        '7f454c46': 'ELF Executable',
        'cafebabe': 'Java Class File',
        'feedface': 'Mach-O Binary',
        '504b0304': 'ZIP Archive (potential executable)',
        '89504e47': 'PNG Image',
        'ffd8ffe0': 'JPEG Image',
        '25504446': 'PDF Document'
      };

      for (const [signature, type] of Object.entries(executableSignatures)) {
        if (content.startsWith(signature)) {
          if (['PE Executable', 'ELF Executable', 'Mach-O Binary'].includes(type)) {
            results.threats.push({
              type: 'executable_content',
              message: `File contains ${type} signature`,
              severity: 'high'
            });
            results.safe = false;
          } else {
            results.warnings.push({
              type: 'file_type_detected',
              message: `Detected as ${type}`,
              severity: 'low'
            });
          }
          break;
        }
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /shell_exec\s*\(/gi,
        /<script[^>]*>.*?<\/script>/gi
      ];

      const textContent = buffer.toString('utf8', 0, Math.min(buffer.length, 10240)); // First 10KB as text
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(textContent)) {
          results.warnings.push({
            type: 'suspicious_content',
            message: `Suspicious pattern detected: ${pattern.source}`,
            severity: 'medium'
          });
        }
      }
    } catch (error) {
      logger.error('Content scanning failed:', error);
    }
  }

  async performVirusScan(filePath, results) {
    try {
      // Placeholder for actual virus scanning integration
      // In production, integrate with ClamAV, Windows Defender, or cloud scanning services
      
      logger.info(`Virus scan placeholder for: ${filePath}`);
      
      // Mock implementation - replace with actual scanner
      const mockScanResult = {
        clean: true,
        threats: [],
        scanTime: Date.now()
      };

      if (!mockScanResult.clean) {
        results.safe = false;
        results.threats.push(...mockScanResult.threats.map(threat => ({
          type: 'virus_detected',
          message: `Virus detected: ${threat}`,
          severity: 'critical'
        })));
        
        results.actions.push('quarantine');
      }
    } catch (error) {
      logger.error('Virus scanning failed:', error);
      results.warnings.push({
        type: 'scan_unavailable',
        message: 'Virus scanning temporarily unavailable',
        severity: 'low'
      });
    }
  }

  async quarantineFile(filePath, reason) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      const fileName = path.basename(filePath);
      const quarantineFileName = `${Date.now()}_${fileName}`;
      const quarantinePath = path.join(this.quarantinePath, quarantineFileName);
      
      await fs.ensureDir(this.quarantinePath);
      await fs.move(filePath, quarantinePath);
      
      // Create quarantine metadata
      const metadata = {
        originalPath: filePath,
        quarantinedAt: new Date(),
        reason,
        checksum: await this.calculateChecksum(quarantinePath)
      };
      
      await fs.writeJSON(`${quarantinePath}.meta`, metadata);
      
      logger.warn(`File quarantined: ${filePath} -> ${quarantinePath}`, { reason });
      
      return {
        quarantined: true,
        quarantinePath,
        metadata
      };
    } catch (error) {
      logger.error('Quarantine failed:', error);
      throw error;
    }
  }

  async calculateChecksum(filePath, algorithm = 'sha256') {
    const fs = require('fs-extra');
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async validateUploadSecurity(userId, filePath, metadata) {
    try {
      // Perform security scan
      const scanResults = await this.scanFile(filePath, metadata);
      
      if (!scanResults.safe) {
        // Quarantine unsafe files
        await this.quarantineFile(filePath, scanResults.threats);
        
        throw new Error(`File rejected due to security threats: ${
          scanResults.threats.map(t => t.message).join(', ')
        }`);
      }

      // Log warnings
      if (scanResults.warnings.length > 0) {
        logger.warn(`File upload warnings for user ${userId}:`, {
          file: metadata.name,
          warnings: scanResults.warnings
        });
      }

      return {
        approved: true,
        scanResults
      };
    } catch (error) {
      logger.error('Upload security validation failed:', error);
      throw error;
    }
  }
}

module.exports = SecurityMiddleware;
