const mongoose = require('mongoose');

// تعريف Schema
const ServiceSchema = new mongoose.Schema({
  _id: {
type: String, // تعريف _id كسلسلة
required: true,
},
  name: { type: String, required: true },
  description: { type: String, required: true },
  serviceType: { type: String, required: true },
  subCategory: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  therapistId: { type: String, required: true },
  province: { type: String, required: true }, // المحافظة
  area: { type: String, required: true }, // المنطقة
});

// تصدير النموذج
module.exports = mongoose.model('Service', ServiceSchema);
