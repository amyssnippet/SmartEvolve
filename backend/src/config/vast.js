const axios = require('axios');
const logger = require('../utils/logger');

class VastConfig {
  constructor() {
    this.apiKey = process.env.VAST_API_KEY;
    this.baseURL = 'https://console.vast.ai/api/v0';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (!this.apiKey) {
      logger.warn('VAST_API_KEY not configured');
    }
  }

  getAxiosConfig() {
    return {
      baseURL: this.baseURL,
      headers: this.headers,
      timeout: 30000
    };
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

const vastConfig = new VastConfig();

module.exports = vastConfig;
