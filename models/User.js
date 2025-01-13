const mongoose = require('mongoose');
const { isEmail } = require('validator'); // لتحقق من صحة البريد الإلكتروني

const UserSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: [true, 'معرف المستخدم مطلوب'],
        unique: true,
        trim: true,
        index: true // إضافة فهرس لتحسين الأداء
    },
    email: {
        type: String,
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: [isEmail, 'البريد الإلكتروني غير صالح'] // تحقق من صحة البريد الإلكتروني
    },
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [6, 'كلمة المرور يجب أن تكون على الأقل 6 أحرف'] // تحقق من قوة كلمة المرور
    },
    name: {
        type: String,
        required: [true, 'الاسم مطلوب'],
        trim: true
    },
    role: {
        type: String,
        enum: ['طالب_خدمة', 'مقدم_خدمة'],
        required: [true, 'الدور مطلوب'],
        trim: true
    },
    fcmToken: {
        type: String,
        default: null,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// إضافة فهرس للحقول التي يتم البحث عنها بشكل متكرر
UserSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model('User', UserSchema);
