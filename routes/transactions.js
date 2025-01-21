const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// إنشاء معاملة جديدة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { serviceId } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    if (req.user.timeBalance < service.hoursRequired) {
      return res.status(400).json({ error: 'Insufficient time balance' });
    }

    // إنشاء المعاملة
    const transaction = await Transaction.create({
      provider: service.therapistId, // مقدم الخدمة
      receiver: req.user._id, // المستفيد
      service: serviceId,
      hours: service.hoursRequired,
      status: 'pending', // حالة المعاملة الافتراضية
    });

    // خصم الساعات من رصيد المستفيد
    req.user.timeBalance -= service.hoursRequired;
    await req.user.save();

    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// تحديث حالة المعاملة
router.post('/:transactionId/update-status', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'completed', 'disputed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
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

    res.json({ message: 'Transaction status updated successfully', transaction });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// تقييم المستخدمين بعد اكتمال الخدمة
router.post('/:transactionId/rate', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { providerRating, receiverRating } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
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

    res.json({ message: 'Ratings updated successfully', transaction });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// استرجاع المعاملات الخاصة بالمستخدم
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { provider: req.user._id }, // المعاملات التي يكون فيها المستخدم مقدم الخدمة
        { receiver: req.user._id }, // المعاملات التي يكون فيها المستخدم مستفيد
      ],
    }).populate('provider receiver service');

    res.json(transactions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
