const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Service = require('../models/Service');
const admin = require('firebase-admin');

// Create booking and notification
router.post('/', async (req, res) => {
  try {
    const { userId, therapistId, serviceId, date, time, therapistToken } = req.body;

    // Validate required fields
    if (!userId || !therapistId || !serviceId || !date || !time || !therapistToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create booking
    const newBooking = new Booking({
      userId,
      therapistId,
      serviceId,
      date: new Date(date),
      time,
      status: 'pending'
    });

    const savedBooking = await newBooking.save();

    // Create notification
    const notification = new Notification({
      userId: therapistId,
      bookingId: savedBooking._id,
      message: `لديك حجز جديد من المستخدم: ${userId}`,
      status: 'pending',
      createdAt: new Date()
    });

    await notification.save();

    // Send Firebase notification
    const message = {
      notification: {
        title: 'حجز جديد',
        body: `لديك حجز جديد من المستخدم: ${userId}`,
      },
      data: {
        bookingId: savedBooking._id.toString(),
        userId: userId,
        type: 'new_booking'
      },
      token: therapistToken
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent notification:', response);
    } catch (error) {
      console.error('Error sending Firebase notification:', error);
      // Continue execution even if Firebase notification fails
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking: savedBooking,
      notification: notification
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get notifications for a user
router.get('/:userId', async (req, res) => {
  try {
    console.log('Fetching notifications for userId:', req.params.userId);
    
    const notifications = await Notification.find({ 
      userId: req.params.userId 
    })
    .sort({ createdAt: -1 })
    .populate({
      path: 'bookingId',
      populate: {
        path: 'serviceId',
        model: 'Service'
      }
    });
    
    console.log('Found notifications:', notifications);

    if (!notifications || notifications.length === 0) {
      return res.json([]);
    }

    const notificationsWithDetails = notifications.map(notification => ({
      id: notification._id,
      message: notification.message,
      status: notification.status,
      createdAt: notification.createdAt,
      bookingDetails: notification.bookingId,
      serviceDetails: notification.bookingId?.serviceId ? {
        name: notification.bookingId.serviceId.name,
        price: notification.bookingId.serviceId.price,
        duration: notification.bookingId.serviceId.duration,
        serviceType: notification.bookingId.serviceId.serviceType
      } : null
    }));

    console.log('Sending notifications with details:', notificationsWithDetails);
    res.json(notificationsWithDetails);

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Update notification status
router.post('/:notificationId/status', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected', 'مقبول', 'مرفوض'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Map Arabic status to English if needed
    const statusMapping = {
      'مقبول': 'accepted',
      'مرفوض': 'rejected'
    };

    const finalStatus = statusMapping[status] || status;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: finalStatus },
      { new: true }
    ).populate('bookingId');

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Update related booking status
    if (notification.bookingId) {
      await Booking.findByIdAndUpdate(
        notification.bookingId._id,
        { status: finalStatus }
      );
    }

    res.json({ 
      message: 'Status updated successfully', 
      notification 
    });

  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

module.exports = router;
