const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// دالة لتوليد userId
const generateUserId = (name, role) => {
  const timestamp = Date.now(); // إضافة الطابع الزمني
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase()}_${timestamp}`;
};

// Middleware للتحقق من Content-Type
const checkContentType = (req, res, next) => {
    console.log('Content-Type:', req.headers['content-type']);
    if (req.headers['content-type'] !== 'application/json') {
        return res.status(400).send('Content-Type must be application/json');
    }
    next();
};

// routes/auth.js
router.post('/update-fcm-token', async (req, res) => {
    try {
        const { userId, fcmToken } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }
        await User.findByIdAndUpdate(userId, { fcmToken });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// تسجيل المستخدم
router.post('/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body; // إضافة phone

  if (!email || !password || !name || !role || !phone) { // التحقق من وجود phone
    return res.status(400).send("جميع الحقول مطلوبة، بما في ذلك رقم الهاتف.");
  }

  try {
    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("البريد الإلكتروني مستخدم بالفعل.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId(name, role);

    const newUser = new User({
      _id: userId,
      userId,
      email,
      password: hashedPassword,
      name,
      role,
      phone // إضافة phone
    });

    const savedUser = await newUser.save();
    res.status(201).send("تم التسجيل بنجاح");
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send("خطأ في التسجيل");
  }
});
// تسجيل الدخول
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // تحويل البريد الإلكتروني إلى أحرف صغيرة وإزالة المسافات الزائدة
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('Login attempt with email:', normalizedEmail);
        
        // البحث عن المستخدم
        const user = await User.findOne({ email: normalizedEmail });
        console.log('Search query:', { email: normalizedEmail });
        console.log('User found:', user);

        if (!user) {
            return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password comparison result:', isMatch);

        if (!isMatch) {
            return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }

        // إنشاء التوكن
        const token = jwt.sign(
            { 
                userId: user.userId, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // إرسال الرد
        res.json({ 
            token,
            role: user.role,
            userId: user.userId,
            name: user.name // إضافة اسم المستخدم للرد
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("حدث خطأ أثناء محاولة تسجيل الدخول.");
    }
});

module.exports = router;
