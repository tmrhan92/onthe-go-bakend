const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fcmRoutes = require('./routes/fcmRoutes');

require('dotenv').config();

const authRoutes = require('./routes/auth');
const therapistRoutes = require('./routes/therapists');
const bookingRoutes = require('./routes/bookings');
const serviceRoutes = require('./routes/services');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');


const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use('/api', fcmRoutes);


// Rate limiting
const apiLimiter = rateLimit({
windowMs: 15 * 60 * 1000, // 15 minutes
max: 100, // Max 100 requests per IP
message: 'Too many requests, please try again later.',
});
app.use('/api/', apiLimiter);

// تعريف المتغيرات
const PORT = process.env.PORT || 5000;
const HOST = '192.168.43.181';

// إضافة مسارات الـ API
app.use('/api/auth', authRoutes);
app.use('/api/therapists', therapistRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications',notificationRoutes);


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
mongoose.connect('mongodb://localhost:27017/massage_support')
    .then(() => {
console.log('MongoDB connected successfully');
// بدء الخادم بعد الاتصال بنجاح بقاعدة البيانات
app.listen(PORT, HOST, () => {
console.log(`Server running on http://${HOST}:${PORT}`);
});
})
    .catch(err => console.error('MongoDB connection error:', err));