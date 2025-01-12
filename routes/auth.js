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
    
    // طباعة البيانات للتحقق
    console.log('Registration attempt:', {
        email,
        name,
        role
    });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateUserId(name, role);
        
        const newUser = new User({
            _id: userId,
            userId,
            email,
            password: hashedPassword,
            name,
            role
        });

        // طباعة كائن المستخدم قبل الحفظ
        console.log('User to be saved:', newUser);

        const savedUser = await newUser.save();
        // طباعة المستخدم المحفوظ
        console.log('Saved user:', savedUser);

        res.status(201).send("نجاح التسجيل");
    } catch (error) {
        console.error("Error during registration:", error);
        // طباعة تفاصيل الخطأ
        if (error.code === 11000) {
            // خطأ التكرار في البيانات الفريدة
            console.log('Duplicate key error:', error.keyPattern);
            return res.status(400).send("البريد الإلكتروني أو معرف المستخدم مستخدم بالفعل.");
        }
        res.status(500).send("خطأ في التسجيل");
    }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        console.log('User found:', user); // للتحقق من وجود المستخدم
        
        if (!user) {
            return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch); // للتحقق من تطابق كلمة المرور
        
        if (!isMatch) {
            return res.status(401).send("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }
        // ... باقي الكود
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("حدث خطأ أثناء محاولة تسجيل الدخول.");
    }
});
module.exports = router;
