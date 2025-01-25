const mongoose = require('mongoose');

/**
 * نموذج المعاملة (Transaction)
 * - يتتبع المعاملات بين مقدم الخدمة (`provider`) ومتلقي الخدمة (`receiver`).
 * - يحتوي على معلومات حول الخدمة (`service`) وعدد الساعات (`hours`).
 * - يدعم حالات متعددة مثل "pending" و"completed" و"disputed".
 */
const transactionSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  hours: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'disputed', 'cancelled'],
    default: 'pending',
  },
  providerComment: {
    type: String,
    default: null,
  },
  receiverComment: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

// تحقق من أن عدد الساعات أكبر من الصفر
transactionSchema.path('hours').validate(function (value) {
  return value > 0;
}, 'عدد الساعات يجب أن يكون أكبر من الصفر');

// Virtual لحساب المدة الإجمالية
transactionSchema.virtual('totalHours').get(function () {
  return this.hours;
});

module.exports = mongoose.model('Transaction', transactionSchema);
