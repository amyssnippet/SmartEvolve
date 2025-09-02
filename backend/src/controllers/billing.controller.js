const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const billingService = require('../services/billingService');
const { asyncHandler } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

class BillingController {
  // Get user billing info
  getBillingInfo = asyncHandler(async (req, res) => {
    const billingInfo = await billingService.getUserBillingInfo(req.user.id);

    res.json({
      success: true,
      billing: billingInfo
    });
  });

  // Get transaction history
  getTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;

    const transactions = await billingService.getTransactionHistory(
      req.user.id,
      { page: parseInt(page), limit: parseInt(limit), type }
    );

    res.json({
      success: true,
      transactions: transactions.rows,
      pagination: {
        total: transactions.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(transactions.count / limit)
      }
    });
  });

  // Create payment order
  createPaymentOrder = asyncHandler(async (req, res) => {
    const { amount, currency = 'INR' } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    try {
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: `order_${req.user.id}_${Date.now()}`,
        notes: {
          user_id: req.user.id,
          user_email: req.user.email
        }
      });

      // Create local payment record
      const payment = await billingService.createPaymentOrder({
        userId: req.user.id,
        razorpayOrderId: razorpayOrder.id,
        amount: amount,
        currency,
        status: 'created'
      });

      logger.info(`Payment order created: ${razorpayOrder.id} for user: ${req.user.email}`);

      res.json({
        success: true,
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID
        },
        payment
      });
    } catch (error) {
      logger.error('Failed to create payment order:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment order'
      });
    }
  });

  // Verify payment
  verifyPayment = asyncHandler(async (req, res) => {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    try {
      // Verify signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment signature'
        });
      }

      // Process payment
      const result = await billingService.processPayment({
        userId: req.user.id,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature
      });

      logger.info(`Payment verified: ${razorpay_payment_id} for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        ...result
      });
    } catch (error) {
      logger.error('Payment verification failed:', error);
      res.status(500).json({
        success: false,
        error: 'Payment verification failed'
      });
    }
  });

  // Handle webhook
  webhook = asyncHandler(async (req, res) => {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      const { event, payload } = req.body;

      switch (event) {
        case 'payment.captured':
          await billingService.handlePaymentCaptured(payload.payment.entity);
          break;
        case 'payment.failed':
          await billingService.handlePaymentFailed(payload.payment.entity);
          break;
        case 'order.paid':
          await billingService.handleOrderPaid(payload.order.entity);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }

      res.json({ status: 'ok' });
    } catch (error) {
      logger.error('Webhook processing failed:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Get token balance
  getTokenBalance = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      balance: {
        tokens: req.user.token_balance,
        usdValue: await billingService.tokensToUSD(req.user.token_balance)
      }
    });
  });

  // Purchase tokens
  purchaseTokens = asyncHandler(async (req, res) => {
    const { packageType } = req.body;

    const packages = {
      starter: { tokens: 1000, price: 10, currency: 'USD' },
      professional: { tokens: 5000, price: 40, currency: 'USD' },
      enterprise: { tokens: 20000, price: 150, currency: 'USD' }
    };

    const selectedPackage = packages[packageType];
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package type'
      });
    }

    try {
      // Convert to INR if needed
      const amountINR = selectedPackage.currency === 'USD' 
        ? selectedPackage.price * 80 // Approximate conversion
        : selectedPackage.price;

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountINR * 100),
        currency: 'INR',
        receipt: `tokens_${req.user.id}_${Date.now()}`,
        notes: {
          user_id: req.user.id,
          package_type: packageType,
          tokens: selectedPackage.tokens
        }
      });

      const payment = await billingService.createTokenPurchase({
        userId: req.user.id,
        razorpayOrderId: razorpayOrder.id,
        packageType,
        tokens: selectedPackage.tokens,
        amount: amountINR,
        currency: 'INR'
      });

      res.json({
        success: true,
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID
        },
        package: selectedPackage,
        payment
      });
    } catch (error) {
      logger.error('Failed to create token purchase:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create token purchase'
      });
    }
  });

  // Get pricing plans
  getPricingPlans = asyncHandler(async (req, res) => {
    const plans = await billingService.getPricingPlans();

    res.json({
      success: true,
      plans
    });
  });

  // Generate invoice
  generateInvoice = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    try {
      const invoice = await billingService.generateInvoice(
        req.user.id,
        transactionId
      );

      res.json({
        success: true,
        invoice
      });
    } catch (error) {
      logger.error('Failed to generate invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate invoice'
      });
    }
  });

  // Get spending analytics
  getSpendingAnalytics = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    try {
      const analytics = await billingService.getSpendingAnalytics(
        req.user.id,
        period
      );

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      logger.error('Failed to get spending analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get spending analytics'
      });
    }
  });
}

module.exports = new BillingController();
