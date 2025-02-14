const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const User = require('../models/User');
const authMiddleware = require('./auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


// إنشاء معاملة جديدة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { serviceId } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, error: 'الخدمة غير موجودة' });
    }
    if (req.user.timeBalance < service.hoursRequired) {
      return res.status(400).json({ success: false, error: 'رصيد الوقت غير كافي' });
    }
    if (service.therapistId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'لا يمكنك طلب خدمة من نفسك' });
    }

    // إنشاء المعاملة
    const transaction = await Transaction.create({
      provider: service.therapistId,
      receiver: req.user._id,
      service: serviceId,
      hours: service.hoursRequired,
      status: 'pending',
    });

    // خصم الساعات من رصيد المستفيد
    req.user.timeBalance -= service.hoursRequired;
    await req.user.save();

    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// تحديث حالة المعاملة
router.post('/:transactionId/update-status', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'completed', 'disputed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'حالة غير صالحة' });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'المعاملة غير موجودة' });
    }
    if (
      transaction.provider.toString() !== req.user._id.toString() &&
      transaction.receiver.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, error: 'غير مصرح بتحديث حالة المعاملة' });
    }

    // تحديث حالة المعاملة
    transaction.status = status;
    await transaction.save();

    // إذا كانت الحالة "completed"، قم بتحديث الرصيد الزمني لمقدم الخدمة
    if (status === 'completed') {
      const provider = await User.findById(transaction.provider);
      if (provider) {
        provider.timeBalance += transaction.hours;
        await provider.save();
      }
    }

    res.json({ success: true, message: 'تم تحديث حالة المعاملة بنجاح', transaction });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// تقييم المستخدمين بعد اكتمال الخدمة
router.post('/:transactionId/rate', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { providerRating, receiverRating } = req.body;

    if (!providerRating && !receiverRating) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم تقييم واحد على الأقل' });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'المعاملة غير موجودة' });
    }
    if (
      transaction.provider.toString() !== req.user._id.toString() &&
      transaction.receiver.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, error: 'غير مصرح بتقديم التقييم' });
    }

    // تحديث تقييم مقدم الخدمة
    if (providerRating) {
      const provider = await User.findById(transaction.provider);
      if (provider) {
        provider.rating = providerRating;
        await provider.save();
      }
    }

    // تحديث تقييم المستفيد
    if (receiverRating) {
      const receiver = await User.findById(transaction.receiver);
      if (receiver) {
        receiver.rating = receiverRating;
        await receiver.save();
      }
    }

    res.json({ success: true, message: 'تم تحديث التقييمات بنجاح', transaction });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// استرجاع المعاملات الخاصة بالمستخدم
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { provider: req.user._id },
        { receiver: req.user._id },
      ],
    }).populate('provider receiver service');

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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
