const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Service = require('../models/Service');
const User = require('../models/User'); // تأكد من استيراد نموذج User
const Therapist = require('../models/Therapist'); // تأكد من استيراد نموذج Therapist
const admin = require('firebase-admin');

// إنشاء حجز وإشعار
router.post('/', async (req, res) => {
  try {
    const { userId, serviceId, date, time } = req.body;

    if (!userId || !serviceId || !date || !time) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
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
      date: new Date(date),
      time,
      status: 'pending'
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار
    const notification = new Notification({
      userId: userId,
      bookingId: savedBooking._id,
      message: `تم حجز الخدمة بنجاح: ${service.name}`,
      status: 'pending',
      createdAt: new Date()
    });

    await notification.save();

    // جلب FCM Token من قاعدة البيانات
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.error('لم يتم العثور على FCM Token للمستخدم');
      return res.status(201).json({
        message: 'تم إنشاء الحجز بنجاح',
        booking: savedBooking,
        notification: notification
      });
    }

    // إرسال إشعار Firebase
    const message = {
      notification: {
        title: 'حجز جديد',
        body: `تم حجز الخدمة بنجاح: ${service.name}`,
      },
      data: {
        bookingId: savedBooking._id.toString(),
        userId: userId,
        type: 'new_booking'
      },
      token: user.fcmToken
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
      notification: notification
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
  }
});

// جلب الإشعارات للمستخدم
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Fetching notifications for userId:', userId);

    if (!userId) {
      return res.status(400).json({ error: 'userId مطلوب' });
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
          model: 'Service',
        },
      });

    const formattedNotifications = notifications.map((notification) => ({
      id: notification._id,
      userId: notification.userId,
      message: notification.message,
      status: notification.status,
      createdAt: notification.createdAt,
      bookingDetails: notification.bookingId,
      serviceDetails: notification.bookingId?.serviceId, // تفاصيل الخدمة
    }));

    res.status(200).json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
  }
});

// جلب الإشعارات لمقدم الخدمة
router.get('/therapist/:therapistId', async (req, res) => {
  try {
    const therapistId = req.params.therapistId;
    console.log('Fetching notifications for therapistId:', therapistId);

    // التحقق من وجود مقدم الخدمة
    const therapist = await Therapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
    }

    // البحث عن الحجوزات المرتبطة بمقدم الخدمة
    const bookings = await Booking.find({ therapistId }).populate('serviceId userId');
    
    // جلب الإشعارات المرتبطة بهذه الحجوزات
    const notifications = await Notification.find({
      bookingId: { $in: bookings.map(booking => booking._id) }
    })
    .sort({ createdAt: -1 })
    .populate({
      path: 'bookingId',
      populate: [
        { path: 'serviceId', model: 'Service' },
        { path: 'userId', model: 'User', select: 'name email phone' }
      ]
    });

    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      message: notification.message,
      status: notification.status,
      createdAt: notification.createdAt,
      bookingDetails: {
        id: notification.bookingId._id,
        date: notification.bookingId.date,
        time: notification.bookingId.time,
        status: notification.bookingId.status,
        user: notification.bookingId.userId,
        service: notification.bookingId.serviceId
      }
    }));

    res.status(200).json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching therapist notifications:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
  }
});

// تحديث حالة الإشعار
router.post('/:notificationId/status', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { status } = req.body;

    console.log(`Updating notification ${notificationId} to status: ${status}`);

    const validStatuses = ['pending', 'accepted', 'rejected'];
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

    // إرسال إشعار Firebase إلى طالب الخدمة
    const user = await User.findById(notification.userId);
    if (!user || !user.fcmToken) {
      console.error('User or FCM token not found');
      return res.status(200).json({ message: 'تم تحديث الحالة بنجاح' });
    }

    const message = {
      notification: {
        title: status === 'accepted' ? 'تم قبول طلبك' : 'تم رفض طلبك',
        body: status === 'accepted' 
          ? `تم قبول طلبك للخدمة: ${notification.bookingId?.serviceId?.name ?? 'خدمة غير معروفة'}` 
          : `تم رفض طلبك للخدمة: ${notification.bookingId?.serviceId?.name ?? 'خدمة غير معروفة'}`,
      },
      data: {
        bookingId: notification.bookingId?._id?.toString() ?? '', // تحقق من وجود bookingId و _id
        userId: notification.userId?.toString() ?? '', // تحقق من وجود userId
        type: 'booking_status_update',
        status: status,
        serviceName: notification.bookingId?.serviceId?.name ?? 'خدمة غير معروفة', // تحقق من وجود serviceId و name
        servicePrice: notification.bookingId?.serviceId?.price?.toString() ?? '0', // تحقق من وجود serviceId و price
        serviceDescription: notification.bookingId?.serviceId?.description ?? '', // تحقق من وجود serviceId و description
      },
      token: user.fcmToken
    };

    try {
      await admin.messaging().send(message);
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending Firebase notification:', error);
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

// جلب الإشعارات للخدمة
router.get('/service/:serviceId', async (req, res) => {
  try {
    const serviceId = req.params.serviceId;
    console.log('Fetching notifications for serviceId:', serviceId);

    // التحقق من وجود الخدمة
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'الخدمة غير موجودة' });
    }

    const notifications = await Notification.find({
      'bookingId.serviceId': serviceId
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'bookingId',
        populate: {
          path: 'serviceId',
          model: 'Service'
        }
      });

    if (!notifications || notifications.length === 0) {
      console.log('No notifications found for serviceId:', serviceId);
      return res.status(404).json({ message: 'لا توجد إشعارات لهذه الخدمة' });
    }

    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      message: notification.message,
      status: notification.status,
      createdAt: notification.createdAt,
      bookingDetails: notification.bookingId,
      serviceDetails: notification.bookingId?.serviceId
    }));

    console.log('Notifications found:', formattedNotifications);
    res.status(200).json(formattedNotifications);

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
  }
});

module.exports = router;
