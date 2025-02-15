const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware للتحقق من التوكن
const auth = async (req, res, next) => {
  try {
    // تحسين طريقة استخراج التوكن
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is required' });
    }

    // التأكد من صيغة التوكن
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Authorization header must be in format: Bearer <token>' });
    }

    const token = parts[1];
    
    // التحقق من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // البحث عن المستخدم
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // تخزين معلومات المستخدم
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Please authenticate' });
  }
};

module.exports = auth;


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
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // تحسين إنشاء التوكن
    const token = jwt.sign(
      {
        userId: user.userId,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '24h', // زيادة مدة صلاحية التوكن
        algorithm: 'HS256' // تحديد خوارزمية التشفير
      }
    );

    // إرسال استجابة منظمة
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          userId: user.userId,
          role: user.role,
          name: user.name,
          timeBalance: user.timeBalance,
          rating: user.rating,
          completedServices: user.completedServices,
          subscriptionStatus: user.subscriptionStatus,
          trialEndDate: user.trialEndDate
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
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
    console.log("🔹 التحقق من اشتراك المستخدم:", req.user.userId);

    const user = await User.findOne({ userId: req.user.userId });

    if (!user) {
      console.error('❌ المستخدم غير موجود:', req.user.userId);
      return res.status(404).json({ message: '❌ المستخدم غير موجود' });
    }

    res.json({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndDate: user.subscriptionEndDate,
    });
  } catch (error) {
    console.error('❌ خطأ في جلب حالة الاشتراك:', error);
    res.status(500).json({ message: 'فشل في جلب حالة الاشتراك: ' + error.message });
  }
});

module.exports = router;
