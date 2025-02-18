const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');
const Service = require('../models/Service');
// حساب المسافة بين نقطتين جغرافيتين
const getDistance = (lat1, lon1, lat2, lon2) => {
const R = 6371;
const dLat = (lat2 - lat1) * (Math.PI / 180);
const dLon = (lon2 - lon1) * (Math.PI / 180);
const a =
Math.sin(dLat / 2) ** 2 +
Math.cos(lat1 * (Math.PI / 180)) *
Math.cos(lat2 * (Math.PI / 180)) *
Math.sin(dLon / 2) ** 2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return R * c;
};

// استرجاع التوكن الخاص بمعالج معين باستخدام userId
router.get('/:id/token', async (req, res) => {
  try {
    const therapist = await Therapist.findOne({ _id: req.params.id }); // البحث باستخدام _id بدلاً من userId
    if (!therapist) {
      return res.status(404).json({ error: 'Therapist not found' });
    }
    res.json({ token: therapist.fcmToken });
  } catch (err) {
    console.error('Error fetching therapist FCM token:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});// حفظ FCM token
// Save FCM token
router.post('/fcm/token', async (req, res) => {
  try {
    const { fcmToken, name = 'Pending Registration', serviceType = 'Pending' } = req.body;

    if (!fcmToken) {
      return res.status(200).json({ message: 'No FCM token provided' });
    }

    const existingTherapist = await Therapist.findOne({ fcmToken });

    if (existingTherapist) {
      return res.status(200).json({
        message: 'Token already exists',
        therapistId: existingTherapist._id,
      });
    }

    const newTherapist = new Therapist({
      fcmToken,
      name,
      serviceType,
      location: { type: 'Point', coordinates: [0, 0] },
    });

    const savedTherapist = await newTherapist.save();

    res.status(201).json({
      message: 'Token saved successfully',
      therapistId: savedTherapist._id,
    });
  } catch (error) {
    console.error('Error saving token:', error);
    res.status(500).json({ error: 'Failed to save token', details: error.message });
  }
});

// في ملف routes/therapists.js
router.get('/:therapistId/token', async (req, res) => {
  try {
    const therapist = await Therapist.findById(req.params.therapistId);
    if (!therapist || !therapist.fcmToken) {
      return res.status(404).json({ error: 'Therapist FCM token not found' });
    }
    res.json({ token: therapist.fcmToken });
  } catch (error) {
    console.error('Error fetching therapist FCM token:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
// Fetch therapist 
// 
// FCM token by serviceId
router.get('/:serviceId/token', async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId).populate('therapistId');
    if (!service || !service.therapistId || !service.therapistId.fcmToken) {
      return res.status(404).json({ error: 'Therapist FCM token not found' });
    }

    res.json({ token: service.therapistId.fcmToken });
  } catch (error) {
    console.error('Error fetching therapist FCM token:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});  // استرجاع المعالجين القريبين
router.get('/nearby', async (req, res) => {
const { latitude, longitude, radius } = req.query;

if (!latitude || !longitude || !radius) {
return res.status(400).json({ error: 'Latitude, longitude, and radius are required' });
}

try {
const nearbyTherapists = await Therapist.find({
location: {
$geoWithin: {
$centerSphere: [[longitude, latitude], radius / 6378.1],
},
},
});

res.json(nearbyTherapists);
} catch (error) {
console.error('Error fetching nearby therapists:', error);
res.status(500).json({ error: 'Internal Server Error' });
}
});

// جلب التوكن باستخدام serviceId
// routes/therapists.js
 
  
  module.exports = router;
