const validator = require('validator');
const { body, param, query } = require('express-validator');

class Validators {
  static isValidEmail(email) {
    return validator.isEmail(email);
  }

  static isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    return password.length >= 8 && passwordRegex.test(password);
  }

  static isValidUsername(username) {
    // 3-30 characters, alphanumeric with underscore and dash
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  }

  static isValidUUID(uuid) {
    return validator.isUUID(uuid);
  }

  static isValidURL(url) {
    return validator.isURL(url);
  }

  static isValidJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  static isValidFileSize(size, maxSize = 10 * 1024 * 1024 * 1024) { // 10GB default
    return size > 0 && size <= maxSize;
  }

  static isValidFileName(fileName) {
    const invalidChars = /[<>:"/\\|?*]/;
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    
    if (invalidChars.test(fileName)) return false;
    if (reservedNames.test(fileName.split('.')[0])) return false;
    if (fileName.length > 255) return false;
    if (fileName.trim().length === 0) return false;
    
    return true;
  }

  static isValidTaskType(taskType) {
    const validTypes = [
      'text_classification',
      'text_generation', 
      'question_answering',
      'named_entity_recognition',
      'sentiment_analysis',
      'translation',
      'summarization',
      'image_classification',
      'object_detection',
      'custom'
    ];
    return validTypes.includes(taskType);
  }

  static isValidFileType(fileType) {
    const validTypes = ['dataset', 'model', 'checkpoint', 'log', 'artifact'];
    return validTypes.includes(fileType);
  }

  static isValidJobStatus(status) {
    const validStatuses = [
      'queued', 'provisioning', 'running', 'paused', 
      'completed', 'failed', 'cancelled'
    ];
    return validStatuses.includes(status);
  }

  static isValidInstanceStatus(status) {
    const validStatuses = [
      'provisioning', 'starting', 'running', 'stopping', 
      'stopped', 'failed', 'terminated'
    ];
    return validStatuses.includes(status);
  }

  static isValidAmount(amount) {
    return typeof amount === 'number' && amount > 0 && isFinite(amount);
  }

  static isValidCurrency(currency) {
    const validCurrencies = ['INR', 'USD'];
    return validCurrencies.includes(currency);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }

  static isValidPagination(page, limit) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    return (
      !isNaN(pageNum) && pageNum > 0 &&
      !isNaN(limitNum) && limitNum > 0 && limitNum <= 100
    );
  }

  static isValidSortOrder(order) {
    return ['asc', 'desc'].includes(order?.toLowerCase());
  }

  static isValidDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return (
      !isNaN(start.getTime()) &&
      !isNaN(end.getTime()) &&
      start <= end
    );
  }

  static isValidHyperparameters(params) {
    if (typeof params !== 'object' || params === null) return false;
    
    const validKeys = [
      'learning_rate', 'batch_size', 'epochs', 'warmup_steps',
      'weight_decay', 'max_length', 'gradient_accumulation_steps'
    ];
    
    return Object.keys(params).every(key => validKeys.includes(key));
  }

  static isValidGPUConfig(config) {
    if (typeof config !== 'object' || config === null) return false;
    
    const requiredFields = ['gpu_type', 'gpu_count'];
    return requiredFields.every(field => config.hasOwnProperty(field));
  }

  // Express-validator middleware helpers
  static createValidationChain() {
    return {
      email: () => body('email').isEmail().normalizeEmail(),
      password: () => body('password').custom(this.isValidPassword),
      username: () => body('username').custom(this.isValidUsername),
      uuid: (field) => body(field).isUUID(),
      filename: (field) => body(field).custom(this.isValidFileName),
      taskType: () => body('taskType').custom(this.isValidTaskType),
      amount: () => body('amount').custom(this.isValidAmount),
      currency: () => body('currency').custom(this.isValidCurrency)
    };
  }
}

module.exports = Validators;
