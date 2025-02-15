const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware للتحقق من التوكن
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId });

    if (!user) {
      throw new Error();
    }

    req.user = user; // إضافة بيانات المستخدم إلى الطلب
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// دالة لتوليد userId
const generateUserId = (name, role) => {
  const timestamp = Date.now();
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase()}_${timestamp}`;
};

// Middleware للتحقق من Content-Type
const checkContentType = (req, res, next) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).send('Content-Type must be application/json');
  }
  next();
};

// تحديث FCM Token
router.post('/update-fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const user = req.user; // تم الحصول على المستخدم من middleware auth

    await User.findByIdAndUpdate(user._id, { fcmToken });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تسجيل المستخدم
router.post('/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  if (!email || !password || !name || !role || !phone) {
    return res.status(400).send("جميع الحقول مطلوبة، بما في ذلك رقم الهاتف.");
  }

  try {
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
      phone,
      timeBalance: 0,
      rating: 0,
      completedServices: 0,
      subscriptionStatus: 'trial',
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
router.post('/update-time-balance', auth, async (req, res) => {
  try {
    const { timeBalance } = req.body;
    const user = req.user; // تم الحصول على المستخدم من middleware auth

    user.timeBalance = timeBalance;
    await user.save();
    res.json({ success: true, timeBalance: user.timeBalance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث تقييم المستخدم
router.post('/update-rating', auth, async (req, res) => {
  try {
    const { rating } = req.body;
    const user = req.user; // تم الحصول على المستخدم من middleware auth

    user.rating = rating;
    await user.save();
    res.json({ success: true, rating: user.rating });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// مسار للحصول على الرصيد الزمني للمستخدم
router.get('/:userId/time-balance', auth, async (req, res) => {
  try {
    const user = req.user; // تم الحصول على المستخدم من middleware auth
    res.json({ success: true, timeBalance: user.timeBalance });
  } catch (error) {
    console.error('Error fetching user time balance:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في النظام' });
  }
});

// مسار للتحقق من حالة الاشتراك
router.get('/subscription-status/:userId', auth, async (req, res) => {
   try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    // إرجاع حالة الاشتراك
    res.json({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndDate: user.subscriptionEndDate
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});


module.exports = router;
