const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User'); // إضافة نموذج المستخدم
const admin = require('firebase-admin');

// تهيئة Firebase Admin SDK
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('../config/serviceAccountKey.json'))
        });
        console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

// دالة مساعدة لإرسال الإشعارات
async function sendNotification(userId, title, body, data = {}) {
    try {
        // البحث عن المستخدم للحصول على الـ FCM token
        const user = await User.findById(userId);
        if (!user || !user.fcmToken) {
            console.log('No FCM token found for user:', userId);
            return;
        }

        const message = {
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                timestamp: new Date().toISOString()
            },
            token: user.fcmToken
        };

        const response = await admin.messaging().send(message);
        console.log('Notification sent successfully:', response);
        return response;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
}

router.post('/', async (req, res) => {
    try {
        const { userId, serviceId, date, time } = req.body;

        // التحقق من البيانات المطلوبة
        if (!userId || !serviceId || !date || !time) {
            return res.status(400).json({ 
                success: false,
                message: 'جميع الحقول مطلوبة',
                missingFields: {
                    userId: !userId,
                    serviceId: !serviceId,
                    date: !date,
                    time: !time
                }
            });
        }

        // التحقق من وجود المستخدم
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // إنشاء الحجز
        const newBooking = new Booking({
            userId,
            serviceId,
            date: new Date(date),
            time,
            status: 'pending' // حالة الحجز الأولية
        });

        // حفظ الحجز
        const savedBooking = await newBooking.save();

        // إنشاء وحفظ الإشعار
        const notification = new Notification({
            userId,
            bookingId: savedBooking._id,
            message: `تم حجز الخدمة بنجاح: ${serviceId}`,
            type: 'booking_created',
            status: 'unread'
        });

        await notification.save();

        // محاولة إرسال إشعار Firebase
        try {
            await sendNotification(
                userId,
                'حجز جديد',
                `تم حجز الخدمة بنجاح: ${serviceId}`,
                {
                    bookingId: savedBooking._id.toString(),
                    type: 'new_booking'
                }
            );
        } catch (notificationError) {
            console.error('Failed to send Firebase notification:', notificationError);
            // نستمر في التنفيذ حتى لو فشل إرسال الإشعار
        }

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الحجز بنجاح',
            booking: savedBooking,
        });

    } catch (error) {
        console.error('Error in booking creation:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في النظام',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
