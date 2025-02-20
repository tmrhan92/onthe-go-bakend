
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('./auth');
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

router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'فشل في إنشاء جلسة الدفع' });
  }
});

// التحقق من حالة الاشتراك
router.get('/subscription-status/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json({
      isActive: user.subscriptionStatus === 'active',
      endDate: user.subscriptionEndDate,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'فشل في جلب حالة الاشتراك' });
  }
});

router.post('/create-payment-intent', async (req, res) => {
  const { amount, currency, userId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { userId },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

router.post('/confirm-payment', async (req, res) => {
  const { paymentIntentId, userId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      const user = await User.findById(userId);
      if (user) {
        user.subscriptionStatus = 'active';
        await user.save();
      }
      res.json({ success: true, message: 'Payment succeeded' });
    } else {
      res.status(400).json({ success: false, message: 'Payment not succeeded' });
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

router.post('/stripe-webhook', async (req, res) => {
  const event = req.body;

  switch (event.type) {
    case 'invoice.payment_succeeded':
      const subscriptionId = event.data.object.subscription;
      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
      if (user) {
        user.subscriptionStatus = 'active';
        await user.save();
      }
      break;
    case 'invoice.payment_failed':
      const failedSubscriptionId = event.data.object.subscription;
      const failedUser = await User.findOne({ stripeSubscriptionId: failedSubscriptionId });
      if (failedUser) {
        failedUser.subscriptionStatus = 'expired';
        await failedUser.save();
      }
      break;
  }

  res.json({ received: true });
});

router.post('/create-subscription', async (req, res) => {
  const { userId, paymentMethodId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      email: user.email,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: process.env.STRIPE_PRICE_ID }],
      expand: ['latest_invoice.payment_intent'],
    });

    user.subscriptionStatus = 'active';
    user.stripeCustomerId = customer.id;
    user.stripeSubscriptionId = subscription.id;
    await user.save();

    res.json({ subscriptionId: subscription.id, clientSecret: subscription.latest_invoice.payment_intent.client_secret });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});


module.exports = router;
