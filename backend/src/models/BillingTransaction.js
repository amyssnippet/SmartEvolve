const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class BillingTransaction extends Model {}

BillingTransaction.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  training_job_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'training_jobs',
      key: 'id'
    }
  },
  payment_order_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'payment_orders',
      key: 'id'
    }
  },
  original_transaction_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'billing_transactions',
      key: 'id'
    }
  },
  transaction_type: {
    type: DataTypes.ENUM('charge', 'credit', 'refund', 'hold', 'release'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  tokens_amount: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  vast_cost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true
  },
  platform_fee: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'BillingTransaction',
  tableName: 'billing_transactions',
  underscored: true
});

module.exports = BillingTransaction;
