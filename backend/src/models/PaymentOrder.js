const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');
const sequelize = getSequelize();

class PaymentOrder extends Model {}

PaymentOrder.init({
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
  razorpay_order_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  razorpay_payment_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  razorpay_signature: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false
  },
  tokens_amount: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  package_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('created', 'completed', 'failed', 'cancelled'),
    defaultValue: 'created'
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'PaymentOrder',
  tableName: 'payment_orders',
  underscored: true
});

module.exports = PaymentOrder;
