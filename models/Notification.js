const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  therapistId: {
    type: String,
    required: false,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'unread'],
    default: 'pending'
  },
  serviceName: {
    type: String,
    required: true
  },
  servicePrice: {
    type: Number,
    required: true
  },
  serviceDescription: {
    type: String,
    default: ''
  },
  userPhone: { // إضافة حقل رقم الهاتف
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  }
});

// إضافة indices للتحسين
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
