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
      return res.status(401).json({ error: 'يجب تسجيل الدخول للوصول' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      throw new Error('المستخدم غير موجود');
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'جلسة غير صالحة، الرجاء إعادة تسجيل الدخول' });
  }
};

// دالة لتوليد userId
const generateUserId = (name, role) => {
  const timestamp = Date.now();
  const sanitizedName = name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, ''); // إزالة الأحرف الخاصة
  return `${sanitizedName}_${role}_${timestamp}`;
};

// Middleware للتحقق من Content-Type
const checkContentType = (req, res, next) => {
  if (!req.is('application/json')) {
    return res.status(400).json({ error: 'يجب أن يكون نوع المحتوى application/json' });
  }
  next();
};

// تحديث FCM Token
router.post('/update-fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM Token مطلوب' });
    }

    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ success: true, message: 'تم تحديث FCM Token بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث FCM Token' });
  }
});

// تسجيل المستخدم
router.post('/register', checkContentType, async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  if (!email || !password || !name || !role || !phone) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }

  try {
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email.toLowerCase() 
          ? "البريد الإلكتروني مستخدم بالفعل" 
          : "رقم الهاتف مستخدم بالفعل"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId(name, role);

    const newUser = new User({
      _id: userId,
      userId,
      email: email.toLowerCase(),
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

    await newUser.save();

    // إنشاء توكن للمستخدم الجديد
    const token = jwt.sign(
      { userId: newUser.userId, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: "تم التسجيل بنجاح",
      token,
      user: {
        userId: newUser.userId,
        name: newUser.name,
        role: newUser.role,
        subscriptionStatus: newUser.subscriptionStatus,
        trialEndDate: newUser.trialEndDate
      }
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "حدث خطأ أثناء التسجيل" });
  }
});

// تسجيل الدخول
router.post('/login', checkContentType, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // التحقق من حالة الاشتراك لمقدمي الخدمة
    if (user.role === 'مقدم_خدمة') {
      if (user.subscriptionStatus === 'trial' && new Date() > user.trialEndDate) {
        user.subscriptionStatus = 'expired';
        await user.save();
        return res.status(403).json({ 
          error: "انتهت فترة التجربة المجانية",
          subscriptionStatus: 'expired'
        });
      }
      if (user.subscriptionStatus === 'expired') {
        return res.status(403).json({ 
          error: "الاشتراك منتهي، يرجى تجديد الاشتراك للمتابعة",
          subscriptionStatus: 'expired'
        });
      }
    }

    const token = jwt.sign(
      { userId: user.userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        timeBalance: user.timeBalance,
        rating: user.rating,
        completedServices: user.completedServices,
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
      }
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

// تحديث الرصيد الزمني
router.post('/:userId/update-time-balance', auth, async (req, res) => {
  try {
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }

    const { timeBalance } = req.body;
    if (typeof timeBalance !== 'number' || timeBalance < 0) {
      return res.status(400).json({ error: 'قيمة الرصيد الزمني غير صالحة' });
    }

    req.user.timeBalance = timeBalance;
    await req.user.save();
    
    res.json({ 
      success: true, 
      timeBalance: req.user.timeBalance,
      message: 'تم تحديث الرصيد الزمني بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الرصيد الزمني' });
  }
});

// تحديث تقييم المستخدم
router.post('/:userId/update-rating', auth, async (req, res) => {
  try {
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }

    const { rating } = req.body;
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'قيمة التقييم غير صالحة' });
    }

    req.user.rating = rating;
    await req.user.save();
    
    res.json({ 
      success: true, 
      rating: req.user.rating,
      message: 'تم تحديث التقييم بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث التقييم' });
  }
});

// الحصول على الرصيد الزمني
router.get('/:userId/time-balance', auth, async (req, res) => {
  try {
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }

    res.json({ 
      success: true, 
      timeBalance: req.user.timeBalance 
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الرصيد الزمني' });
  }
});

// التحقق من حالة الاشتراك
router.get('/:userId/subscription-status', auth, async (req, res) => {
  try {
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }

    // التحقق من انتهاء فترة التجربة لمقدمي الخدمة
    if (req.user.role === 'مقدم_خدمة' && 
        req.user.subscriptionStatus === 'trial' && 
        new Date() > req.user.trialEndDate) {
      req.user.subscriptionStatus = 'expired';
      await req.user.save();
    }

    res.json({
      success: true,
      subscriptionStatus: req.user.subscriptionStatus,
      subscriptionPlan: req.user.subscriptionPlan,
      subscriptionEndDate: req.user.subscriptionEndDate,
      trialEndDate: req.user.trialEndDate
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق من حالة الاشتراك' });
  }
});

module.exports = router;
