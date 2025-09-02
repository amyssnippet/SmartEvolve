const crypto = require('crypto');
const User = require('../models/User');
const BillingTransaction = require('../models/BillingTransaction');
const PaymentOrder = require('../models/PaymentOrder');
const logger = require('../utils/logger');

class BillingService {
  async getUserBillingInfo(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const totalSpent = await BillingTransaction.sum('amount', {
        where: { 
          user_id: userId,
          transaction_type: 'charge'
        }
      }) || 0;

      const totalCredits = await BillingTransaction.sum('amount', {
        where: { 
          user_id: userId,
          transaction_type: 'credit'
        }
      }) || 0;

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const monthlySpending = await BillingTransaction.sum('amount', {
        where: {
          user_id: userId,
          transaction_type: 'charge',
          created_at: { [require('sequelize').Op.gte]: currentMonth }
        }
      }) || 0;

      return {
        tokenBalance: user.token_balance,
        totalSpent: parseFloat(totalSpent),
        totalCredits: parseFloat(totalCredits),
        monthlySpending: parseFloat(monthlySpending),
        usdValue: await this.tokensToUSD(user.token_balance)
      };
    } catch (error) {
      logger.error('Failed to get billing info:', error);
      throw error;
    }
  }

  async getTransactionHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20, type } = options;
      const offset = (page - 1) * limit;

      const whereClause = { user_id: userId };
      if (type) whereClause.transaction_type = type;

      const transactions = await BillingTransaction.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      return transactions;
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      throw error;
    }
  }

  async createPaymentOrder(orderData) {
    try {
      const { userId, razorpayOrderId, amount, currency, status } = orderData;

      const payment = await PaymentOrder.create({
        user_id: userId,
        razorpay_order_id: razorpayOrderId,
        amount: amount,
        currency: currency,
        status: status
      });

      logger.info(`Payment order created: ${razorpayOrderId}`);
      return payment;
    } catch (error) {
      logger.error('Failed to create payment order:', error);
      throw error;
    }
  }

  async processPayment(paymentData) {
    try {
      const { userId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = paymentData;

      // Find the payment order
      const paymentOrder = await PaymentOrder.findOne({
        where: { razorpay_order_id: razorpayOrderId }
      });

      if (!paymentOrder) {
        throw new Error('Payment order not found');
      }

      // Update payment order
      await paymentOrder.update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: 'completed'
      });

      // Calculate tokens (1 USD = 100 tokens, 1 INR = 1.2 tokens)
      const tokens = paymentOrder.currency === 'USD' 
        ? paymentOrder.amount * 100
        : Math.floor(paymentOrder.amount * 1.2);

      // Add tokens to user balance
      const user = await User.findByPk(userId);
      await user.update({
        token_balance: user.token_balance + tokens
      });

      // Create transaction record
      const transaction = await BillingTransaction.create({
        user_id: userId,
        payment_order_id: paymentOrder.id,
        transaction_type: 'credit',
        amount: paymentOrder.amount,
        tokens_amount: tokens,
        currency: paymentOrder.currency,
        description: `Token purchase - ${tokens} tokens`
      });

      logger.info(`Payment processed: ${razorpayPaymentId}, added ${tokens} tokens`);

      return {
        payment: paymentOrder,
        transaction,
        tokensAdded: tokens,
        newBalance: user.token_balance + tokens
      };
    } catch (error) {
      logger.error('Failed to process payment:', error);
      throw error;
    }
  }

  async createTokenPurchase(purchaseData) {
    try {
      const { userId, razorpayOrderId, packageType, tokens, amount, currency } = purchaseData;

      const purchase = await PaymentOrder.create({
        user_id: userId,
        razorpay_order_id: razorpayOrderId,
        amount: amount,
        currency: currency,
        tokens_amount: tokens,
        package_type: packageType,
        status: 'created'
      });

      return purchase;
    } catch (error) {
      logger.error('Failed to create token purchase:', error);
      throw error;
    }
  }

  async chargeTokens(userId, amount, description, jobId = null) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.token_balance < amount) {
        throw new Error('Insufficient token balance');
      }

      // Deduct tokens
      await user.update({
        token_balance: user.token_balance - amount
      });

      // Create transaction record
      const transaction = await BillingTransaction.create({
        user_id: userId,
        training_job_id: jobId,
        transaction_type: 'charge',
        tokens_amount: amount,
        amount: this.tokensToUSD(amount),
        description: description
      });

      logger.info(`Tokens charged: ${amount} from user ${userId}`);

      return {
        transaction,
        newBalance: user.token_balance - amount
      };
    } catch (error) {
      logger.error('Failed to charge tokens:', error);
      throw error;
    }
  }

  async refundTokens(userId, amount, description, originalTransactionId = null) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add tokens back
      await user.update({
        token_balance: user.token_balance + amount
      });

      // Create refund transaction
      const transaction = await BillingTransaction.create({
        user_id: userId,
        original_transaction_id: originalTransactionId,
        transaction_type: 'refund',
        tokens_amount: amount,
        amount: this.tokensToUSD(amount),
        description: description
      });

      logger.info(`Tokens refunded: ${amount} to user ${userId}`);

      return {
        transaction,
        newBalance: user.token_balance + amount
      };
    } catch (error) {
      logger.error('Failed to refund tokens:', error);
      throw error;
    }
  }

  async handlePaymentCaptured(paymentEntity) {
    try {
      const orderId = paymentEntity.order_id;
      const paymentOrder = await PaymentOrder.findOne({
        where: { razorpay_order_id: orderId }
      });

      if (paymentOrder && paymentOrder.status !== 'completed') {
        await this.processPayment({
          userId: paymentOrder.user_id,
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: orderId,
          razorpaySignature: paymentEntity.signature
        });
      }
    } catch (error) {
      logger.error('Failed to handle payment captured:', error);
    }
  }

  async handlePaymentFailed(paymentEntity) {
    try {
      const orderId = paymentEntity.order_id;
      const paymentOrder = await PaymentOrder.findOne({
        where: { razorpay_order_id: orderId }
      });

      if (paymentOrder) {
        await paymentOrder.update({
          status: 'failed',
          failure_reason: paymentEntity.error_description
        });

        logger.info(`Payment failed: ${paymentEntity.id}`);
      }
    } catch (error) {
      logger.error('Failed to handle payment failure:', error);
    }
  }

  async handleOrderPaid(orderEntity) {
    try {
      logger.info(`Order paid webhook: ${orderEntity.id}`);
      // Additional order paid handling logic
    } catch (error) {
      logger.error('Failed to handle order paid:', error);
    }
  }

  tokensToUSD(tokens) {
    return tokens / 100; // 1 USD = 100 tokens
  }

  usdToTokens(usd) {
    return Math.floor(usd * 100); // 1 USD = 100 tokens
  }

  getPricingPlans() {
    return {
      starter: {
        name: 'Starter',
        tokens: 1000,
        price: 10,
        currency: 'USD',
        features: ['Basic training jobs', 'Community support', '10GB storage']
      },
      professional: {
        name: 'Professional',
        tokens: 5000,
        price: 40,
        currency: 'USD',
        popular: true,
        features: ['Advanced training jobs', 'Priority support', '50GB storage', 'Custom models']
      },
      enterprise: {
        name: 'Enterprise',
        tokens: 20000,
        price: 150,
        currency: 'USD',
        features: ['Unlimited training jobs', '24/7 support', '200GB storage', 'Custom models', 'API access']
      }
    };
  }

  async generateInvoice(userId, transactionId) {
    try {
      const transaction = await BillingTransaction.findOne({
        where: { id: transactionId, user_id: userId },
        include: [{ model: User, as: 'user' }]
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const invoice = {
        invoiceNumber: `INV-${transaction.id}`,
        date: transaction.created_at,
        user: {
          name: `${transaction.user.first_name} ${transaction.user.last_name}`,
          email: transaction.user.email
        },
        items: [{
          description: transaction.description,
          tokens: transaction.tokens_amount,
          amount: transaction.amount,
          currency: transaction.currency
        }],
        total: transaction.amount,
        currency: transaction.currency
      };

      return invoice;
    } catch (error) {
      logger.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  async getSpendingAnalytics(userId, period = '30d') {
    try {
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const transactions = await BillingTransaction.findAll({
        where: {
          user_id: userId,
          transaction_type: 'charge',
          created_at: { [require('sequelize').Op.gte]: startDate }
        },
        attributes: [
          [require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'date'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
        ],
        group: [require('sequelize').fn('DATE', require('sequelize').col('created_at'))],
        order: [[require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'ASC']],
        raw: true
      });

      const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.total), 0);
      const avgDaily = totalSpent / days;

      return {
        period: `${days} days`,
        totalSpent,
        avgDailySpending: avgDaily,
        dailyBreakdown: transactions.map(t => ({
          date: t.date,
          amount: parseFloat(t.total)
        }))
      };
    } catch (error) {
      logger.error('Failed to get spending analytics:', error);
      throw error;
    }
  }
}

module.exports = new BillingService();
