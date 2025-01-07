// controllers/bookingController.js
const Booking = require('../models/Booking');

exports.createBooking = async (req, res) => {
  try {
    const { userId, serviceId, therapistId, bookingDate, bookingTime } = req.body;

    if (!userId || !serviceId || !therapistId || !bookingDate || !bookingTime) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newBooking = new Booking({
      userId,
      serviceId,
      therapistId,
      bookingDate,
      bookingTime
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
};
