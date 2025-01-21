const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fcmRoutes = require('./routes/fcmRoutes');
const transactionRoutes = require('./routes/transactions'); // استيراد مسار transactions

require('dotenv').config(); // تحميل المتغيرات البيئية من ملف .env

// تعريف المتغيرات
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/massage_support';

// إنشاء تطبيق Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per IP
    message: 'Too many requests, please try again later.',
    keyGenerator: (req) => {
        // استخدم رأس X-Forwarded-For إذا كان موجودًا
        return req.headers['x-forwarded-for'] || req.ip;
    },
});
app.use('/api/', apiLimiter);

// إضافة مسارات الـ API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/therapists', require('./routes/therapists'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/services', require('./routes/services'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/transactions', transactionRoutes); // مسار transactions

app.use('/api', fcmRoutes);

// مسار رئيسي
app.get('/', (req, res) => {
    res.send('Welcome to the Massage API!');
});

// مسار 404
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// الاتصال بقاعدة البيانات MongoDB
const connectToDatabase = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1); // إغلاق التطبيق في حالة فشل الاتصال
    }
};

// بدء الخادم
const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

// تهيئة التطبيق
const initializeApp = async () => {
    await connectToDatabase();
    startServer();
};

// تشغيل التطبيق
initializeApp();
