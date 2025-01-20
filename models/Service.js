// models/Service.js
const mongoose = require('mongoose');


const serviceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
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
module.exports = mongoose.model('Service', ServiceSchema);

module.exports = mongoose.model('Service', ServiceSchema);
