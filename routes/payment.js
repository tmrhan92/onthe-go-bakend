const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('./auth'); 
const User = require('../models/User');

const router = express.Router();

// ✅ إنشاء جلسة دفع في Stripe
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
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
    console.error('❌ خطأ في إنشاء جلسة الدفع:', error);
    res.status(500).json({ error: 'فشل في إنشاء جلسة الدفع' });
  }
});
// ✅ تأكيد الاشتراك بعد الدفع
router.post('/confirm-subscription', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    console.log("📢 Received subscriptionId:", subscriptionId); // ✅ تحقق من أن `subscriptionId` ليس فارغًا
    if (!subscriptionId) {
      return res.status(400).json({ error: '🚨 Subscription ID is required' });
    }

    const user = await User.findOne({ userId: req.user.userId });

    if (!user) {
      console.error("🚨 User not found in database:", req.user.userId);
      return res.status(404).json({ error: '🚫 المستخدم غير موجود' });
    }

    console.log("🔹 تأكيد الاشتراك لـ:", user.userId);

    // ✅ جلب معلومات الاشتراك من Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log("📢 Retrieved Subscription:", subscription);

    if (subscription.status === 'active') {
      user.subscriptionStatus = 'active';
      user.stripeSubscriptionId = subscriptionId;
      user.subscriptionStartDate = new Date();
      user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      user.nextPaymentDate = new Date(subscription.current_period_end * 1000);
      await user.save();

      res.json({
        success: true,
        message: '✅ تم تفعيل الاشتراك بنجاح',
        subscription: {
          status: user.subscriptionStatus,
          endDate: user.subscriptionEndDate,
          nextPaymentDate: user.nextPaymentDate
        }
      });
    } else {
      console.error("❌ Subscription is not active:", subscription.status);
      res.status(400).json({
        success: false,
        message: `❌ فشل في تفعيل الاشتراك، الحالة الحالية: ${subscription.status}`
      });
    }
  } catch (error) {
    console.error('❌ خطأ في تأكيد الاشتراك:', error);
    res.status(500).json({ error: 'فشل في تأكيد الاشتراك' });
  }
});



// ✅ Webhook لمعالجة الدفع التلقائي
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("🔹 Webhook Event Received:", event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSession(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleSuccessfulPayment(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleFailedPayment(event.data.object);
        break;
    }
    res.json({ received: true });
  } catch (error) {
    console.error('❌ خطأ في معالجة Webhook:', error);
    res.status(500).json({ error: 'فشل في معالجة Webhook' });
  }
});

// ✅ تحديث اشتراك المستخدم بعد الدفع الناجح
async function handleSuccessfulPayment(invoice) {
  const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });

  if (user) {
    user.subscriptionStatus = 'active';
    user.lastPaymentDate = new Date();
    user.nextPaymentDate = new Date(invoice.next_payment_attempt * 1000);
    await user.save();
    console.log("✅ تم تحديث حالة الاشتراك للمستخدم:", user.userId);
  }
}

// ✅ تحديث حالة المستخدم إذا فشل الدفع
async function handleFailedPayment(invoice) {
  const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });

  if (user) {
    user.subscriptionStatus = 'expired';
    await user.save();
    console.log("❌ فشل الدفع، تم تحديث حالة المستخدم:", user.userId);
  }
}

module.exports = router;
