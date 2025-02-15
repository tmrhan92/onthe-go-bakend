const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('/auth'); // تأكد من المسار الصحيح
const User = require('../models/User');

// إنشاء نية دفع
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    // إنشاء أو الحصول على عميل Stripe
    let stripeCustomer;
    if (user.stripeCustomerId) {
      stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.userId
        }
      });
      user.stripeCustomerId = stripeCustomer.id;
      await user.save();
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: 'usd',
      customer: stripeCustomer.id,
      metadata: {
        userId: user.userId
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'فشل في إنشاء عملية الدفع' });
  }
});

// إنشاء جلسة دفع
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId); // الآن req.user موجود
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

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
        userId: user.userId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'فشل في إنشاء جلسة الدفع' });
  }
});


// تأكيد الاشتراك
router.post('/confirm-subscription', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

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
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
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
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
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

// معالج Webhook من Stripe
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutSession(session);
        break;
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        await handleSuccessfulPayment(invoice);
        break;
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        await handleFailedPayment(failedInvoice);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'فشل في معالجة webhook' });
  }
});

// دوال معالجة Webhook
async function handleCheckoutSession(session) {
  const user = await User.findOne({ email: session.customer_email });
  if (user) {
    user.subscriptionStatus = 'active';
    await user.save();
  }
}

async function handleSuccessfulPayment(invoice) {
  if (invoice.subscription) {
    const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
    if (user) {
      user.subscriptionStatus = 'active';
      user.lastPaymentDate = new Date();
      user.nextPaymentDate = new Date(invoice.next_payment_attempt * 1000);
      await user.save();
    }
  }
}

async function handleFailedPayment(invoice) {
  if (invoice.subscription) {
    const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
    if (user) {
      user.subscriptionStatus = 'expired';
      await user.save();
    }
  }
}

module.exports = router;
