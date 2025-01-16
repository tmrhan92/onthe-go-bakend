const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Service = require('../models/Service');
const admin = require('firebase-admin');

// Create booking and notification
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
      status: 'pending'
    });

    const savedBooking = await newBooking.save();

    // إنشاء الإشعار
    const notification = new Notification({
      userId: userId,
      bookingId: savedBooking._id,
      message: `تم حجز الخدمة بنجاح: ${serviceId}`,
      status: 'pending',
      createdAt: new Date()
    });

    await notification.save();

    // إرسال إشعار Firebase
    const message = {
      notification: {
        title: 'حجز جديد',
        body: `تم حجز الخدمة بنجاح: ${serviceId}`,
        android: {
          priority: 'high',
          notification: {
            channel_id: 'default'
          }
        }
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
      if (!response) {
        console.error('Empty response from FCM');
        return;
      }
      console.log('Full FCM response:', response);
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
const getNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
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
      serviceDetails: notification.bookingId?.serviceId,
    }));

    res.status(200).json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'حدث خطأ في النظام', details: error.message });
  }
};

module.exports = {
  getNotifications,
};


// Get notifications for a user
// routes/notifications.js
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


// Update notification status
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

// Get notifications for a service
router.get('/service/:serviceId', async (req, res) => {
  try {
    const serviceId = req.params.serviceId;
    console.log('Fetching notifications for serviceId:', serviceId);

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
