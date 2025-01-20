// models/Service.js
const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true },
  serviceType: { type: String, required: true },
  subCategory: { type: String, required: true },
  therapistId: { type: String, required: true },
  latitude: { type: Number, required: true }, // خط العرض
  longitude: { type: Number, required: true }, // خط الطول
  governorate: { type: String, required: true }, // المحافظة
  area: { type: String, required: true }, // المنطقة
  createdAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model('Service', ServiceSchema);
