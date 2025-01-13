const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const admin = require('firebase-admin');
const fs = require('fs');

// تحميل Firebase
if (!admin.apps.length) {
  const serviceAccountPath = require.resolve('../config/serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('Service account key file not found!');
  }
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

router.post('/', async (req, res) => {
  try {
    const { userId, serviceId, date, time } = req.body;

    // تحقق من الحقول المطلوبة
    if (!userId || !serviceId || !date || !time) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    // تحقق من صحة التاريخ
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({ error: 'تاريخ غير صالح' });
    }

    // إنشاء الحجز
    const newBooking = new Booking({
      userId,
      serviceId,
      date: bookingDate,
      time,
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار
    const notification = new Notification({
      userId,
      bookingId: savedBooking._id,
      message: `تم حجز الخدمة بنجاح: ${serviceId}`,
    });

    await notification.save();

    // إرسال إشعار Firebase (اختياري)
    const message = {
      notification: {
        title: 'حجز جديد',
        body: `تم حجز الخدمة بنجاح: ${serviceId}`,
      },
      data: {
        bookingId: savedBooking._id.toString(),
        userId: userId,
        type: 'new_booking',
      },
      token: 'USER_FCM_TOKEN', // استبدل هذا بقيمة FCM token الخاصة بالمستخدم
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent notification:', response);
    } catch (error) {
      console.error('Error sending Firebase notification:', error);
      // يمكنك إضافة إجراءات إضافية هنا، مثل تسجيل الخطأ في قاعدة البيانات
    }

    // إرسال الاستجابة
    res.status(201).json({
      message: 'تم إنشاء الحجز بنجاح',
      booking: savedBooking,
      notification: notification, // إضافة تفاصيل الإشعار
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام' });
  }
});

module.exports = router;
