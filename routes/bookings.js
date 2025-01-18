const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Therapist = require('../models/Therapist'); // استيراد نموذج Therapist

const User = require('../models/User');
const Service = require('../models/Service');
const admin = require('firebase-admin');

// تهيئة Firebase Admin SDK
const firebaseConfig = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!firebaseConfig.private_key) {
  throw new Error('FIREBASE_PRIVATE_KEY is missing or invalid in environment variables.');
}

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig)
});

// دالة مساعدة لإرسال الإشعارات
async function sendNotification(userId, title, body, data = {}, therapistId = null) {
    try {
        // إرسال الإشعار للمستخدم
        if (userId) {
            const user = await User.findById(userId);
            if (user && user.fcmToken) {
                await admin.messaging().send({
                    notification: { title, body },
                    data: { ...data, timestamp: new Date().toISOString() },
                    token: user.fcmToken
                });
            }
        }

        // إرسال الإشعار لمقدم الخدمة
        if (therapistId) {
            const therapist = await Therapist.findById(therapistId);
            if (therapist && therapist.fcmToken) {
                await admin.messaging().send({
                    notification: { title, body },
                    data: { ...data, timestamp: new Date().toISOString() },
                    token: therapist.fcmToken
                });
            }
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
}




// مسار لإرسال إشعار
router.post('/send-notification', async (req, res) => {
  const { fcmToken, title, body, data } = req.body;

  try {
    const response = await sendNotification(fcmToken, title, body, data);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// إنشاء حجز وإشعار
// routes/bookings.js
router.post('/', async (req, res) => {
  try {
    const { userId, serviceId, date, time } = req.body;

    // التحقق من وجود المستخدم أولاً
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // التحقق من وجود الخدمة
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'الخدمة غير موجودة' });
    }

    // إنشاء الحجز
    const newBooking = new Booking({
      userId,
      serviceId,
      therapistId: service.therapistId, // تأكد من وجود هذا الحقل في نموذج الخدمة
      date: new Date(date),
      time,
      status: 'pending'
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار
  const notification = new Notification({
  userId: userId,
  bookingId: savedBooking._id,
  message: `تم حجز خدمة ${service.name} بنجاح`,
  status: 'pending',
  createdAt: new Date(),
  serviceId: service._id, // إضافة معرف الخدمة
  serviceName: service.name, // إضافة اسم الخدمة
  servicePrice: service.price, // إضافة سعر الخدمة
  serviceDescription: service.description || '', // إضافة وصف الخدمة
});



    await notification.save();

    // إرسال إشعار Firebase إلى المستخدم
    if (user.fcmToken) {
      const message = {
        notification: {
          title: 'حجز جديد',
          body: `تم حجز خدمة ${service.name} بنجاح`,
        },
        data: {
          bookingId: savedBooking._id.toString(),
          userId: userId,
          type: 'new_booking',
          serviceName: service.name,
          servicePrice: service.price.toString(),
          serviceDescription: service.description || '',
          userPhone: user.phone, // إضافة رقم هاتف طالب الخدمة

        },
        token: user.fcmToken
      };

      try {
        await admin.messaging().send(message);
      } catch (error) {
        console.error('Error sending Firebase notification to user:', error);
      }
    }

    // إرسال إشعار إلى مقدم الخدمة
    if (service.therapistId) {
      const therapist = await Therapist.findById(service.therapistId);
      if (therapist && therapist.fcmToken) {
        const therapistMessage = {
          notification: {
            title: 'طلب حجز جديد',
            body: `لديك طلب حجز جديد من ${user.name}`,
          },
          data: {
            bookingId: savedBooking._id.toString(),
            userId: userId,
            type: 'new_booking_request',
            userName: user.name,
            serviceName: service.name,
          },
          token: therapist.fcmToken
        };

        try {
          await admin.messaging().send(therapistMessage);
        } catch (error) {
          console.error('Error sending Firebase notification to therapist:', error);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحجز بنجاح',
      booking: savedBooking,
      notification: notification
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في النظام', 
      details: error.message 
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

    // التحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
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

    console.log('Successfully updated notification:', notification);

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

// معالجة الأخطاء العامة
router.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false,
    message: 'حدث خطأ غير متوقع في النظام',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;
