const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  _id: {
    type: String, // تعريف _id كسلسلة
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  serviceType: {
    type: String,
    required: true,
  },
  subCategory: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  hoursRequired: {
    type: Number,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  therapistId: {
    type: String,
    required: true,
  },
  province: {
    type: String,
    required: true,
  },
  area: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'ongoing', 'completed'],
    default: 'available',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Service', ServiceSchema);
