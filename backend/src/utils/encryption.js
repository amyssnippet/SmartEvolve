const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;
const SALT_ROUNDS = 12;

class EncryptionUtils {
  static async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  static encrypt(text) {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipher(ALGORITHM, SECRET_KEY, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  static decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      
      const decipher = crypto.createDecipher(ALGORITHM, SECRET_KEY, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  static generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateApiKey() {
    const prefix = 'aip_';
    const key = crypto.randomBytes(24).toString('hex');
    return prefix + key;
  }

  static hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  static generateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static verifyChecksum(data, checksum) {
    const calculatedChecksum = this.generateChecksum(data);
    return calculatedChecksum === checksum;
  }

  static generateSecureId() {
    return crypto.randomUUID();
  }
}

module.exports = EncryptionUtils;
