const mongoose = require('mongoose');

const TherapistSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(), // تعيين _id تلقائيًا
  },
  fcmToken: { type: String, unique: true }, // جعله اختياريًا
  name: { type: String, default: 'Pending Registration' },
  serviceType: { type: String, default: 'Pending' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
});

TherapistSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Therapist', TherapistSchema);
