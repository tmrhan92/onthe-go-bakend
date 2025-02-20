const mongoose = require('mongoose');
const { isEmail } = require('validator');

/**
 * نموذج المستخدم (User)
 * - يحتوي على معلومات المستخدم الأساسية مثل الاسم والبريد الإلكتروني وكلمة المرور.
 * - يتتبع الرصيد الزمني (`timeBalance`) وعدد الخدمات المكتملة (`completedServices`).
 * - يدعم أدوارًا متعددة مثل "طالب_خدمة" و"مقدم_خدمة".
 */
const UserSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
    unique: true,
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
    default: 0,
  },
  earnedHours: {
    type: Number,
    default: 0,
  },
  spentHours: {
    type: Number,
    default: 0,
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
  subscriptionStatus: {
    type: String,
    enum: ['active', 'trial', 'expired'],
    default: 'trial',
  },
  trialEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  stripeCustomerId: {
    type: String,
    sparse: true,
  },
  stripeSubscriptionId: {
    type: String,
    sparse: true,
  },
  subscriptionPlan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free',
  },
  subscriptionStartDate: {
    type: Date,
  },
  subscriptionEndDate: {
    type: Date,
  },
  lastPaymentDate: {
    type: Date,
  },
  nextPaymentDate: {
    type: Date,
  }
}, {
  // Enable virtuals
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating time balance
UserSchema.virtual('calculatedTimeBalance').get(function() {
  return this.earnedHours - this.spentHours;
});

// Validate that time balance cannot be negative
UserSchema.path('timeBalance').validate(function(value) {
  return value >= 0;
}, 'الرصيد الزمني لا يمكن أن يكون سالبًا');

// Pre-save middleware to update timeBalance before saving
UserSchema.pre('save', function(next) {
  this.timeBalance = this.earnedHours - this.spentHours;
  next();
});

// إضافة الفهارس الجديدة
UserSchema.index({ stripeCustomerId: 1 });
UserSchema.index({ stripeSubscriptionId: 1 });
UserSchema.index({ subscriptionStatus: 1 });

// Index creation for frequently queried fields
UserSchema.index({ email: 1 });
UserSchema.index({ userId: 1 });
UserSchema.index({ role: 1 });

module.exports = mongoose.model('User', UserSchema);
