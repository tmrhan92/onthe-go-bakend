const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Service = require('../models/Service');
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
      userId,
      serviceId,
      date: new Date(date),
      time,
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار وحفظه في قاعدة البيانات
    const notification = new Notification({
      userId: userId, // هنا يتم ربط الإشعار بالمستخدم
      bookingId: savedBooking._id, // معرف الحجز
      message: `تم حجز الخدمة بنجاح: ${serviceId}`,
    });

    await notification.save();

    // استجابة النجاح
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
