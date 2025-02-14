
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('../middleware/auth');
const User = require('../models/User');

// إنشاء نية دفع
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // إنشاء أو الحصول على عميل Stripe
    let stripeCustomer;
    if (user.stripeCustomerId) {
      stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user._id
        }
      });
      user.stripeCustomerId = stripeCustomer.id;
      await user.save();
    }

    // إنشاء اشتراك
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'فشل في إنشاء الاشتراك' });
  }
});

// تأكيد الاشتراك
router.post('/confirm-subscription', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const user = await User.findById(req.user._id);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (subscription.status === 'active') {
      user.subscriptionStatus = 'active';
      user.stripeSubscriptionId = subscriptionId;
      user.subscriptionStartDate = new Date();
      user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      user.nextPaymentDate = new Date(subscription.current_period_end * 1000);
      
      await user.save();
      
      res.json({
        success: true,
        message: 'تم تفعيل الاشتراك بنجاح',
        subscription: {
          status: user.subscriptionStatus,
          endDate: user.subscriptionEndDate,
          nextPaymentDate: user.nextPaymentDate
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'فشل في تفعيل الاشتراك'
      });
    }
  } catch (error) {
    console.error('Error confirming subscription:', error);
    res.status(500).json({ error: 'فشل في تأكيد الاشتراك' });
  }
});

// إلغاء الاشتراك
router.post('/cancel-subscription', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'لا يوجد اشتراك نشط' });
    }

    const subscription = await stripe.subscriptions.del(user.stripeSubscriptionId);
    
    user.subscriptionStatus = 'expired';
    user.subscriptionEndDate = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'تم إلغاء الاشتراك بنجاح'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'فشل في إلغاء الاشتراك' });
  }
});

// الحصول على حالة الاشتراك
router.get('/subscription-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.stripeSubscriptionId) {
      return res.json({
        status: user.subscriptionStatus,
        endDate: user.subscriptionEndDate
      });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    
    res.json({
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      nextPaymentDate: user.nextPaymentDate,
      stripeStatus: subscription.status
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'فشل في جلب حالة الاشتراك' });
  }
});

module.exports = router;
