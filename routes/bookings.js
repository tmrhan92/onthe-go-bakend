const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../config/serviceAccountKey.json')),
  });
}

router.post('/', async (req, res) => {
  try {
    const { userId, serviceId, date, time } = req.body;

    if (!userId || !serviceId || !date || !time) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    // إنشاء الحجز
    const newBooking = new Booking({
      userId, // استخدام userId بدلاً من therapistId
      serviceId,
      date: new Date(date),
      time,
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار
    const notification = new Notification({
      userId: userId, // الإشعار مرتبط بالمستخدم
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
        type: 'new_booking'
      },
      token: 'USER_FCM_TOKEN' // يمكنك استبدال هذا بقيمة FCM token الخاصة بالمستخدم
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent notification:', response);
    } catch (error) {
      console.error('Error sending Firebase notification:', error);
    }

    res.status(201).json({
      message: 'تم إنشاء الحجز بنجاح',
      booking: savedBooking,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام' });
  }
});

module.exports = router;