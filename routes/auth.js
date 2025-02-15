const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const auth = require('./auth'); // استيراد middleware التحقق من التوكن



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

// تحديث FCM Token
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
      phone, // إضافة phone
      timeBalance: 0, // إضافة الرصيد الزمني الافتراضي
      rating: 0, // إضافة التقييم الافتراضي
      completedServices: 0, // إضافة عدد الخدمات المكتملة الافتراضي
      subscriptionStatus: 'trial', // حالة الاشتراك الافتراضية
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يومًا من الآن
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
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }

    // التحقق من حالة الاشتراك
    if (user.role === 'مقدم_خدمة' && user.subscriptionStatus === 'trial' && new Date() > user.trialEndDate) {
      user.subscriptionStatus = 'expired';
      await user.save();
      return res.status(403).send("انتهت فترة التجربة المجانية. يرجى الاشتراك للاستمرار.");
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      role: user.role,
      userId: user.userId,
      name: user.name,
      timeBalance: user.timeBalance,
      rating: user.rating,
      completedServices: user.completedServices,
      subscriptionStatus: user.subscriptionStatus,
      trialEndDate: user.trialEndDate,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("حدث خطأ أثناء محاولة تسجيل الدخول.");
  }
});

// تحديث الرصيد الزمني
router.post('/update-time-balance', async (req, res) => {
  try {
    const { userId, timeBalance } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }
    user.timeBalance = timeBalance;
    await user.save();
    res.json({ success: true, timeBalance: user.timeBalance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث تقييم المستخدم
router.post('/update-rating', async (req, res) => {
  try {
    const { userId, rating } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }
    user.rating = rating;
    await user.save();
    res.json({ success: true, rating: user.rating });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار للحصول على الرصيد الزمني للمستخدم
router.get('/:userId/time-balance', async (req, res) => {
    try {
        const userId = req.params.userId;

        // البحث عن المستخدم
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        // إرجاع الرصيد الزمني
        res.json({ success: true, timeBalance: user.timeBalance });
    } catch (error) {
        console.error('Error fetching user time balance:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في النظام' });
    }
});

// مسار للتحقق من حالة الاشتراك
router.get('/subscription-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // البحث عن المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }

    // إرجاع حالة الاشتراك
    res.json({
      success: true,
      subscriptionStatus: user.subscriptionStatus,
      trialEndDate: user.trialEndDate,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في النظام' });
  }
});

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, 'tokens.token': token });

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};


module.exports = router;
