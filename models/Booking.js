const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  serviceId: { type: String, ref: 'Service', required: true },
  therapistId: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  userPhone: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);
