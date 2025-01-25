const mongoose = require('mongoose');
const { isEmail } = require('validator');

const UserSchema = new mongoose.Schema({
  _id: {
    type: String, // تعريف _id كسلسلة
    required: true,
  },
  userId: {
    type: String,
    required: true,
    unique: true, // تأكد من أنه فريد
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [isEmail, 'البريد الإلكتروني غير صالح'],
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون على الأقل 6 أحرف'],
  },
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
  },
  phone: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['طالب_خدمة', 'مقدم_خدمة'],
    required: [true, 'الدور مطلوب'],
    trim: true,
  },
  fcmToken: {
    type: String,
    default: null,
    trim: true,
  },
  timeBalance: {
    type: Number,
    default: 0, // الرصيد الزمني الافتراضي
  },
  earnedHours: {
    type: Number,
    default: 0, // الساعات المكتسبة من تقديم الخدمات
  },
  spentHours: {
    type: Number,
    default: 0, // الساعات المنفقة على طلب الخدمات
  },
  rating: {
    type: Number,
    default: 0,
  },
  completedServices: {
    type: Number,
    default: 0,
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'verified', 'premium'],
    default: 'basic',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
