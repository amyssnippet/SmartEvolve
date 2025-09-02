const crypto = require('crypto');
const logger = require('../../utils/logger');
const FilesystemEngine = require('./filesystem.engine');

class DistributedEngine extends FilesystemEngine {
  constructor(options = {}) {
    super(options);
    this.nodes = options.nodes || [{ path: this.basePath, weight: 1 }];
    this.replicationFactor = options.replicationFactor || 1;
    this.hashRing = this.buildHashRing();
  }

  buildHashRing() {
    const ring = [];
    
    this.nodes.forEach((node, index) => {
      const weight = node.weight || 1;
      const virtualNodes = weight * 100; // 100 virtual nodes per weight unit
      
      for (let i = 0; i < virtualNodes; i++) {
        const hash = crypto
          .createHash('sha256')
          .update(`${node.path}:${i}`)
          .digest('hex');
        
        ring.push({
          hash,
          nodeIndex: index,
          node
        });
      }
    });

    // Sort by hash value
    ring.sort((a, b) => a.hash.localeCompare(b.hash));
    
    return ring;
  }

  getNodesForKey(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const nodes = [];
    let startIndex = 0;

    // Find the first node with hash >= key hash
    for (let i = 0; i < this.hashRing.length; i++) {
      if (this.hashRing[i].hash >= hash) {
        startIndex = i;
        break;
      }
    }

    // Select nodes for replication
    const selectedNodeIndices = new Set();
    let currentIndex = startIndex;

    while (nodes.length < this.replicationFactor && selectedNodeIndices.size < this.nodes.length) {
      const ringNode = this.hashRing[currentIndex];
      
      if (!selectedNodeIndices.has(ringNode.nodeIndex)) {
        nodes.push(ringNode.node);
        selectedNodeIndices.add(ringNode.nodeIndex);
      }

      currentIndex = (currentIndex + 1) % this.hashRing.length;
    }

    return nodes;
  }

  async write(relativePath, data, options = {}) {
    try {
      const nodes = this.getNodesForKey(relativePath);
      const results = [];
      let successCount = 0;

      // Write to all selected nodes
      for (const node of nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          const result = await nodeEngine.write(relativePath, data, options);
          
          results.push({
            node: node.path,
            success: true,
            result
          });
          
          successCount++;
        } catch (error) {
          results.push({
            node: node.path,
            success: false,
            error: error.message
          });
          
          logger.error(`Write failed on node ${node.path}:`, error);
        }
      }

      // Check if we have enough successful writes
      const requiredSuccess = Math.ceil(this.replicationFactor / 2);
      
      if (successCount < requiredSuccess) {
        throw new Error(`Write failed: only ${successCount}/${this.replicationFactor} nodes succeeded`);
      }

      return {
        path: relativePath,
        replicationResults: results,
        successCount
      };
    } catch (error) {
      logger.error('Distributed write failed:', error);
      throw error;
    }
  }

  async read(relativePath, options = {}) {
    try {
      const nodes = this.getNodesForKey(relativePath);
      
      // Try to read from nodes in order of preference
      for (const node of nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          return await nodeEngine.read(relativePath, options);
        } catch (error) {
          logger.warn(`Read failed on node ${node.path}, trying next node:`, error);
          continue;
        }
      }

      throw new Error('File not found on any node');
    } catch (error) {
      logger.error('Distributed read failed:', error);
      throw error;
    }
  }

  async delete(relativePath) {
    try {
      const nodes = this.getNodesForKey(relativePath);
      let successCount = 0;

      // Delete from all nodes
      for (const node of nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          const success = await nodeEngine.delete(relativePath);
          
          if (success) {
            successCount++;
          }
        } catch (error) {
          logger.error(`Delete failed on node ${node.path}:`, error);
        }
      }

      return successCount > 0;
    } catch (error) {
      logger.error('Distributed delete failed:', error);
      throw error;
    }
  }

  async exists(relativePath) {
    try {
      const nodes = this.getNodesForKey(relativePath);
      
      // Check if file exists on any node
      for (const node of nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          const exists = await nodeEngine.exists(relativePath);
          
          if (exists) {
            return true;
          }
        } catch (error) {
          logger.warn(`Exists check failed on node ${node.path}:`, error);
        }
      }

      return false;
    } catch (error) {
      logger.error('Distributed exists check failed:', error);
      return false;
    }
  }

  async repairFile(relativePath) {
    try {
      const nodes = this.getNodesForKey(relativePath);
      const availableNodes = [];
      
      // Check which nodes have the file
      for (const node of nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          const exists = await nodeEngine.exists(relativePath);
          
          if (exists) {
            availableNodes.push(node);
          }
        } catch (error) {
          logger.error(`Repair check failed on node ${node.path}:`, error);
        }
      }

      if (availableNodes.length === 0) {
        throw new Error('File not found on any node for repair');
      }

      // Replicate to missing nodes
      const missingNodes = nodes.filter(node => !availableNodes.includes(node));
      
      if (missingNodes.length > 0) {
        const sourceEngine = new FilesystemEngine({ basePath: availableNodes[0].path });
        const data = await sourceEngine.read(relativePath);
        
        for (const missingNode of missingNodes) {
          try {
            const targetEngine = new FilesystemEngine({ basePath: missingNode.path });
            await targetEngine.write(relativePath, data);
            
            logger.info(`Repaired file ${relativePath} on node ${missingNode.path}`);
          } catch (error) {
            logger.error(`Repair failed for node ${missingNode.path}:`, error);
          }
        }
      }

      return {
        repaired: missingNodes.length,
        available: availableNodes.length,
        total: nodes.length
      };
    } catch (error) {
      logger.error('File repair failed:', error);
      throw error;
    }
  }

  async getDistributedStats() {
    try {
      const nodeStats = [];
      
      for (const node of this.nodes) {
        try {
          const nodeEngine = new FilesystemEngine({ basePath: node.path });
          const stats = await nodeEngine.getStorageStats();
          
          nodeStats.push({
            path: node.path,
            weight: node.weight,
            ...stats
          });
        } catch (error) {
          nodeStats.push({
            path: node.path,
            weight: node.weight,
            error: error.message
          });
        }
      }

      const totalStats = nodeStats.reduce((acc, node) => {
        if (!node.error) {
          acc.totalSize += node.totalSize || 0;
          acc.fileCount += node.fileCount || 0;
          acc.directoryCount += node.directoryCount || 0;
        }
        return acc;
      }, { totalSize: 0, fileCount: 0, directoryCount: 0 });

      return {
        nodes: nodeStats,
        replicationFactor: this.replicationFactor,
        ...totalStats
      };
    } catch (error) {
      logger.error('Failed to get distributed stats:', error);
      throw error;
    }
  }
}

module.exports = DistributedEngine;
