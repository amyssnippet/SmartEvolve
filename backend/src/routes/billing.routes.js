const express = require('express');
const billingController = require('../controllers/billing.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { billingValidation, queryValidation, uuidParam } = require('../middleware/validation.middleware');
const { rateLimits } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// Webhook endpoint (no auth required)
router.post('/webhook', 
  rateLimits.payment,
  billingController.webhook
);

// All other routes require authentication
router.use(authMiddleware);

router.get('/info', 
  billingController.getBillingInfo
);

router.get('/transactions', 
  queryValidation.pagination,
  billingController.getTransactions
);

router.post('/create-order', 
  rateLimits.payment,
  billingValidation.createPayment,
  billingController.createPaymentOrder
);

router.post('/verify-payment', 
  rateLimits.payment,
  billingController.verifyPayment
);

router.get('/token-balance', 
  billingController.getTokenBalance
);

router.post('/purchase-tokens', 
  rateLimits.payment,
  billingController.purchaseTokens
);

router.get('/pricing-plans', 
  billingController.getPricingPlans
);

router.get('/invoice/:transactionId', 
  uuidParam('transactionId'),
  billingController.generateInvoice
);

router.get('/analytics/spending', 
  billingController.getSpendingAnalytics
);

module.exports = router;
