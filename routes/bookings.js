const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');
const admin = require('firebase-admin');

// تهيئة Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL
  })
});

// دالة مساعدة لإرسال الإشعارات
async function sendNotification(userId, title, body, data = {}) {
    try {
        const user = await User.findById(userId);
        if (!user || !user.fcmToken) {
            console.log('No FCM token found for user:', userId);
            return;
        }

        const message = {
            notification: { title, body },
            data: { ...data, timestamp: new Date().toISOString() },
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

// إنشاء حجز وإشعار
router.post('/', async (req, res) => {
    try {
        const { userId, serviceId, date, time } = req.body;

        // التحقق من البيانات المطلوبة
        if (!userId || !serviceId || !date || !time) {
            return res.status(400).json({ 
                success: false,
                message: 'جميع الحقول مطلوبة',
                missingFields: { userId: !userId, serviceId: !serviceId, date: !date, time: !time }
            });
        }

        // التحقق من وجود المستخدم
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
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
            status: 'unread' // استخدام 'unread' كقيمة مسموح بها
        });

        await notification.save();

        // محاولة إرسال إشعار Firebase
        try {
            await sendNotification(
                userId,
                'حجز جديد',
                `تم حجز الخدمة بنجاح: ${serviceId}`,
                { bookingId: savedBooking._id.toString(), type: 'new_booking' }
            );
        } catch (notificationError) {
            console.error('Failed to send Firebase notification:', notificationError);
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

// الحصول على إشعارات مستخدم معين
router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Fetching notifications for userId:', userId);

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'bookingId',
                populate: {
                    path: 'serviceId',
                    model: 'Service'
                }
            });

        console.log('Found notifications:', notifications.length);

        const formattedNotifications = notifications.map(notification => ({
            id: notification._id,
            userId: notification.userId,
            message: notification.message,
            status: notification.status,
            createdAt: notification.createdAt,
            serviceId: notification.bookingId?.serviceId?._id || '',
            bookingDetails: notification.bookingId,
            serviceDetails: notification.bookingId?.serviceId
        }));

        res.status(200).json(formattedNotifications);

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ 
            error: 'حدث خطأ في النظام', 
            details: error.message 
        });
    }
});

// تحديث حالة الإشعار
router.post('/:notificationId/status', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { status } = req.body;

        console.log(`Updating notification ${notificationId} to status: ${status}`);

        const validStatuses = ['pending', 'accepted', 'rejected', 'unread']; // إضافة 'unread'
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صالحة' });
        }

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { status },
            { new: true }
        ).populate('bookingId');

        if (!notification) {
            return res.status(404).json({ error: 'الإشعار غير موجود' });
        }

        // تحديث حالة الحجز المرتبط
        if (notification.bookingId) {
            await Booking.findByIdAndUpdate(
                notification.bookingId._id,
                { status }
            );
        }

        console.log('Successfully updated notification status');

        res.json({
            message: 'تم تحديث الحالة بنجاح',
            notification
        });

    } catch (error) {
        console.error('Error updating notification status:', error);
        res.status(500).json({ 
            error: 'حدث خطأ في النظام', 
            details: error.message 
        });
    }
});

module.exports = router;
