const express = require('express');
const Therapist = require('../models/Therapist');
const router = express.Router();

// API للبحث عن معالجين قريبين
router.get('/therapists/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude || !radius) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const nearbyTherapists = await Therapist.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(radius), // المسافة بالـ متر
        },
      },
    });

    res.status(200).json(nearbyTherapists);
  } catch (error) {
    console.error('Error fetching nearby therapists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
