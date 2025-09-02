const axios = require('axios');
const NodeSSH = require('node-ssh');
const VastInstance = require('../models/VastInstance');
const vastConfig = require('../config/vast');
const logger = require('../utils/logger');

class VastService {
  constructor() {
    this.axiosInstance = axios.create(vastConfig.getAxiosConfig());
  }

  async searchInstances(criteria = {}) {
    try {
      const query = this.buildSearchQuery(criteria);
      
      const response = await this.axiosInstance.get('/bundles', {
        params: { q: JSON.stringify(query) }
      });

      logger.info('Vast.ai instances search completed');
      return response.data;
    } catch (error) {
      logger.error('Failed to search Vast.ai instances:', error);
      throw new Error('Failed to search instances');
    }
  }

  buildSearchQuery(criteria) {
    const query = {
      verified: { eq: criteria.verified !== false },
      external: { eq: false },
      rentable: { eq: true }
    };

    if (criteria.gpu_name) {
      query.gpu_name = { like: `%${criteria.gpu_name}%` };
    }

    if (criteria.gpu_count) {
      query.num_gpus = { gte: criteria.gpu_count };
    }

    if (criteria.max_price) {
      query.dph_total = { lte: criteria.max_price };
    }

    if (criteria.min_ram) {
      query.cpu_ram = { gte: criteria.min_ram };
    }

    if (criteria.region) {
      query.geolocation = { like: `%${criteria.region}%` };
    }

    return query;
  }

  async createInstance(options) {
    try {
      const { askId, imageTag, userId, trainingJobId, envVars = {} } = options;

      // Get ask details first
      const askResponse = await this.axiosInstance.get(`/bundles/${askId}`);
      const askData = askResponse.data;

      if (!askData) {
        throw new Error('Ask not found');
      }

      // Create instance
      const createResponse = await this.axiosInstance.put(`/asks/${askId}/`, {
        client_id: 'ai-platform',
        image: imageTag,
        disk: 50, // GB
        label: `training-${trainingJobId || 'instance'}`,
        onstart: 'bash /start.sh',
        runtype: 'ssh',
        env: {
          TRAINING_JOB_ID: trainingJobId,
          USER_ID: userId,
          ...envVars
        }
      });

      const contractId = createResponse.data.new_contract;

      // Create local instance record
      const instance = await VastInstance.create({
        user_id: userId,
        training_job_id: trainingJobId,
        vast_contract_id: contractId,
        ask_id: askId,
        machine_id: askData.machine_id,
        instance_type: askData.machine_id?.toString(),
        gpu_name: askData.gpu_name,
        gpu_count: askData.num_gpus,
        gpu_total_memory: askData.gpu_total_ram,
        cpu_cores: askData.cpu_cores,
        ram_gb: Math.floor(askData.cpu_ram / 1000),
        disk_gb: askData.disk_space,
        hourly_cost: askData.dph_total,
        region: askData.geolocation,
        status: 'provisioning'
      });

      // Start monitoring for SSH availability
      this.monitorInstanceStartup(instance.id);

      logger.info(`Vast.ai instance created: ${contractId}`);
      return instance;
    } catch (error) {
      logger.error('Failed to create Vast.ai instance:', error);
      throw new Error('Failed to create instance');
    }
  }

  async getInstanceStatus(contractId) {
    try {
      const response = await this.axiosInstance.get(`/instances/${contractId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get instance status:', error);
      return null;
    }
  }

  async terminateInstance(contractId) {
    try {
      const response = await this.axiosInstance.delete(`/instances/${contractId}/`);
      logger.info(`Vast.ai instance terminated: ${contractId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to terminate Vast.ai instance:', error);
      throw new Error('Failed to terminate instance');
    }
  }

  async monitorInstanceStartup(instanceId) {
    const instance = await VastInstance.findByPk(instanceId);
    if (!instance) return;

    const maxAttempts = 30; // 15 minutes with 30-second intervals
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const status = await this.getInstanceStatus(instance.vast_contract_id);
        
        if (status) {
          await instance.update({
            status: status.actual_status || 'starting',
            ssh_host: status.public_ipaddr,
            ssh_port: status.ssh_port,
            jupyter_url: status.jupyter_url
          });

          if (status.actual_status === 'running' && status.ssh_port) {
            // Test SSH connectivity
            const sshConnected = await this.testSSHConnection(
              status.public_ipaddr,
              status.ssh_port
            );

            if (sshConnected) {
              await instance.update({
                status: 'running',
                health_status: 'healthy',
                last_health_check: new Date()
              });
              
              logger.info(`Instance ${instanceId} is ready for use`);
              return;
            }
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 30000); // Check again in 30 seconds
        } else {
          await instance.update({
            status: 'failed',
            health_status: 'unhealthy'
          });
          logger.warn(`Instance ${instanceId} failed to start within timeout`);
        }
      } catch (error) {
        logger.error('Error monitoring instance startup:', error);
      }
    };

    // Start monitoring
    setTimeout(checkStatus, 10000); // Wait 10 seconds before first check
  }

  async testSSHConnection(host, port, timeout = 10000) {
    const ssh = new NodeSSH();
    
    try {
      await ssh.connect({
        host,
        port,
        username: 'root',
        privateKey: process.env.SSH_PRIVATE_KEY,
        readyTimeout: timeout
      });
      
      ssh.dispose();
      return true;
    } catch (error) {
      return false;
    }
  }

  async executeCommand(instanceId, command) {
    const instance = await VastInstance.findByPk(instanceId);
    if (!instance || instance.status !== 'running') {
      throw new Error('Instance not available');
    }

    const ssh = new NodeSSH();
    
    try {
      await ssh.connect({
        host: instance.ssh_host,
        port: instance.ssh_port,
        username: instance.ssh_user,
        privateKey: process.env.SSH_PRIVATE_KEY
      });

      const result = await ssh.execCommand(command);
      ssh.dispose();

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code
      };
    } catch (error) {
      logger.error('Failed to execute SSH command:', error);
      throw new Error('SSH command execution failed');
    }
  }

  async getInstanceMetrics(contractId) {
    try {
      // This would typically fetch metrics from Vast.ai API
      // For now, return mock data structure
      return {
        gpu_utilization: 0,
        memory_utilization: 0,
        network_io: { in: 0, out: 0 },
        disk_io: { read: 0, write: 0 },
        uptime: 0
      };
    } catch (error) {
      logger.error('Failed to get instance metrics:', error);
      return null;
    }
  }

  async getPricingEstimate(options) {
    try {
      const { gpuType, gpuCount, hours, region } = options;
      
      // Search for similar instances to get pricing
      const instances = await this.searchInstances({
        gpu_name: gpuType,
        gpu_count: gpuCount,
        region
      });

      if (!instances.offers || instances.offers.length === 0) {
        return { error: 'No instances available for specified criteria' };
      }

      // Calculate pricing statistics
      const prices = instances.offers.slice(0, 10).map(offer => offer.dph_total);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      const totalCost = {
        min: minPrice * hours,
        max: maxPrice * hours,
        avg: avgPrice * hours
      };

      return {
        hourly: { min: minPrice, max: maxPrice, avg: avgPrice },
        total: totalCost,
        currency: 'USD',
        availableInstances: instances.offers.length
      };
    } catch (error) {
      logger.error('Failed to get pricing estimate:', error);
      throw new Error('Failed to get pricing estimate');
    }
  }

  async getInstanceTemplates() {
    return [
      {
        id: 'pytorch-basic',
        name: 'PyTorch Basic',
        image: 'pytorch/pytorch:latest',
        description: 'Basic PyTorch environment with common ML libraries',
        frameworks: ['PyTorch', 'Transformers', 'Datasets']
      },
      {
        id: 'tensorflow-basic',
        name: 'TensorFlow Basic',
        image: 'tensorflow/tensorflow:latest-gpu',
        description: 'Basic TensorFlow environment with GPU support',
        frameworks: ['TensorFlow', 'Keras']
      },
      {
        id: 'custom-training',
        name: 'Custom Training',
        image: 'aiplatform/training:latest',
        description: 'Custom training environment with our platform tools',
        frameworks: ['PyTorch', 'Transformers', 'Custom Tools']
      }
    ];
  }
}

module.exports = new VastService();
