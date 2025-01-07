const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// دالة لتوليد userId
function generateUserId(name, role) {
return `${name.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase()}`;
}

// تسجيل المستخدم
router.post('/register', async (req, res) => {
const { email, password, name, role } = req.body;

if (!email || !password || !name || !role) {
return res.status(400).send("جميع الحقول مطلوبة.");
}

if (!['طالب_خدمة', 'مقدم_خدمة'].includes(role)) {
return res.status(400).send("الدور غير صالح.");
}

const existingUser = await User.findOne({ email });
if (existingUser) {
return res.status(400).send("البريد الإلكتروني مستخدم بالفعل.");
}

const hashedPassword = await bcrypt.hash(password, 10);

// توليد userId كـ String
const userId = generateUserId(name, role);
if (!userId) {
return res.status(400).send("فشل في توليد userId."); // تأكد أن userId ليس null
}

const newUser = new User({ _id: userId, userId, email, password: hashedPassword, name, role });

try {
await newUser.save();
res.status(201).send("نجاح التسجيل");
} catch (error) {
console.error("Error during registration:", error); // تحسين رسالة الخطأ
res.status(500).send("خطأ في التسجيل");
}
});

// تسجيل الدخول
// تسجيل الدخول
router.post('/login', async (req, res) => {
const { email, password } = req.body;

try {
const user = await User.findOne({ email });

if (!user) {
return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
}

const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) {
return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
}

const token = jwt.sign({ userId: user.userId, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

// الآن أضف userId هنا
res.json({ token, role: user.role, userId: user.userId }); // أضف userId هنا
} catch (error) {
console.error("Error during login:", error);
res.status(500).send("حدث خطأ أثناء محاولة تسجيل الدخول.");
}
});

module.exports = router;
