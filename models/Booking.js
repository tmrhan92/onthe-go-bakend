const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // استخدام userId بدلاً من therapistId
  serviceId: { type: String, ref: 'Service', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);