const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// دالة لتوليد userId
function generateUserId(name, role) {
    return `${name.toLowerCase().replace(/\s+/g, '_')}_${role.toLowerCase()}`;
}

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
        await User.findByIdAndUpdate(userId, { fcmToken });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// تسجيل المستخدم
router.post('/register', async (req, res) => {
    const { email, password, name, role } = req.body;
    
    // طباعة البيانات للتحقق
    console.log('Registration attempt:', {
        email,
        name,
        role
    });

    if (!email || !password || !name || !role) {
        return res.status(400).send("جميع الحقول مطلوبة.");
    }

    // تحويل البريد الإلكتروني إلى أحرف صغيرة وإزالة المسافات الزائدة
    const normalizedEmail = email.toLowerCase().trim();

    if (!['طالب_خدمة', 'مقدم_خدمة'].includes(role)) {
        return res.status(400).send("الدور غير صالح.");
    }

    try {
        // التحقق من وجود المستخدم
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).send("البريد الإلكتروني مستخدم بالفعل.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateUserId(name, role);
        
        if (!userId) {
            return res.status(400).send("فشل في توليد userId.");
        }

        const newUser = new User({
            _id: userId,
            userId,
            email: normalizedEmail,
            password: hashedPassword,
            name,
            role
        });

        // طباعة كائن المستخدم قبل الحفظ
        console.log('User to be saved:', newUser);

        const savedUser = await newUser.save();
        console.log('Saved user:', savedUser);

        res.status(201).send("تم التسجيل بنجاح");
    } catch (error) {
        console.error("Error during registration:", error);
        if (error.code === 11000) {
            return res.status(400).send("البريد الإلكتروني أو معرف المستخدم مستخدم بالفعل.");
        }
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
