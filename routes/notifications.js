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

    // التحقق من وجود الخدمة والمستخدم
    const [service, user] = await Promise.all([
      Service.findById(serviceId),
      User.findById(userId)
    ]);

    if (!service) {
      return res.status(404).json({ error: 'الخدمة غير موجودة' });
    }

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
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

    // إنشاء الإشعار مع رقم الهاتف
    const notification = new Notification({
      userId: userId,
      bookingId: savedBooking._id,
      message: `تم حجز خدمة ${service.name} بنجاح`,
      status: 'pending',
      createdAt: new Date(),
      serviceId: service._id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDescription: service.description || '',
      userPhone: user.phone // إضافة رقم الهاتف من بيانات المستخدم
    });

    await notification.save();

    // إرسال إشعار Firebase إذا كان لدى المستخدم token
    if (user.fcmToken) {
      const message = {
        notification: {
          title: 'حجز جديد',
          body: `تم حجز الخدمة بنجاح: ${service.name}`,
        },
        data: {
          bookingId: savedBooking._id.toString(),
          userId: userId,
          type: 'new_booking',
          userPhone: user.phone // إضافة رقم الهاتف للإشعار
        },
        token: user.fcmToken
      };

      try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
      } catch (error) {
        console.error('Error sending Firebase notification:', error);
      }
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

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'serviceId', model: 'Service' },
          { path: 'userId', model: 'User', select: 'phone name email' }
        ]
      });

    const formattedNotifications = notifications.map((notification) => ({
      id: notification._id,
      userId: notification.userId,
      message: notification.message,
      status: notification.status,
      createdAt: notification.createdAt,
      bookingDetails: notification.bookingId,
      serviceDetails: notification.bookingId?.serviceId,
      userPhone: notification.userPhone // إضافة رقم الهاتف للبيانات المُرسلة
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

    const notification = await Notification.findById(notificationId)
      .populate({
        path: 'bookingId',
        populate: [
          { 
            path: 'userId',
            model: 'User',
            select: 'name email phone fcmToken'
          },
          { 
            path: 'serviceId',
            model: 'Service'
          }
        ]
      });

    if (!notification) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }

    // تحديث حالة الإشعار
    notification.status = status;

    // إضافة/تحديث رقم الهاتف عند قبول الطلب
    if (status === 'accepted' && notification.bookingId?.userId?.phone) {
      notification.userPhone = notification.bookingId.userId.phone;
      console.log('User phone updated:', notification.userPhone);
    }

    await notification.save();

    // تحديث حالة الحجز المرتبط
    if (notification.bookingId) {
      await Booking.findByIdAndUpdate(
        notification.bookingId._id,
        { status }
      );
    }

    // إرسال إشعار للمستخدم
    const user = notification.bookingId?.userId;
    if (user?.fcmToken) {
      const serviceDetails = notification.bookingId?.serviceId || {};
      const notificationMessage = {
        notification: {
          title: status === 'accepted' ? 'تم قبول طلبك' : 'تم رفض طلبك',
          body: `${status === 'accepted' ? 'تم قبول' : 'تم رفض'} طلبك للخدمة: ${serviceDetails.name || 'خدمة غير معروفة'}`,
        },
        data: {
          bookingId: notification.bookingId._id.toString(),
          userId: user._id.toString(),
          type: 'booking_status_update',
          status: status,
          serviceName: serviceDetails.name || '',
          servicePrice: serviceDetails.price?.toString() || '0',
          serviceDescription: serviceDetails.description || '',
          userPhone: status === 'accepted' ? (user.phone || '') : ''
        },
        token: user.fcmToken
      };

      try {
        await admin.messaging().send(notificationMessage);
        console.log('Firebase notification sent successfully');
      } catch (error) {
        console.error('Error sending Firebase notification:', error);
      }
    }

    res.json({
      message: 'تم تحديث الحالة بنجاح',
      notification: {
        ...notification.toObject(),
        userPhone: status === 'accepted' ? notification.userPhone : undefined
      }
    });

  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
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
