const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');
const User = require('../models/User'); // Make sure to import User model

// Main route for saving FCM token
router.post('/fcm/token', async (req, res) => {
  console.log('Received token save request:', req.body);
  
  try {
    const { fcmToken, userId, role } = req.body;

    // Validate required fields
    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Check for existing token
    const existingTherapist = await Therapist.findOne({ fcmToken });

    if (existingTherapist) {
      console.log('Found existing therapist:', existingTherapist._id);
      return res.status(200).json({
        message: 'Token already exists',
        therapistId: existingTherapist._id
      });
    }

    // If userId and role are provided, handle user-specific token
    if (userId && role) {
      // Update user's FCM token if user exists
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { fcmToken },
        { new: true }
      );

      // Handle therapist role
      if (role === 'مقدم_خدمة') {
        let therapist = await Therapist.findOne({ userId });
        
        if (therapist) {
          therapist.fcmToken = fcmToken;
          await therapist.save();
        } else {
          therapist = new Therapist({
            _id: userId,
            userId,
            fcmToken,
            name: updatedUser?.name || 'Temporary Therapist',
            serviceType: 'Pending',
            location: {
              type: 'Point',
              coordinates: [0, 0]
            }
          });
          await therapist.save();
        }

        return res.status(200).json({
          message: 'Token saved successfully',
          therapistId: therapist._id,
          userId
        });
      }

      // For non-therapist users
      return res.status(200).json({
        message: 'Token saved successfully',
        userId
      });
    }

    // Handle anonymous token registration
    const newTherapist = new Therapist({
      fcmToken,
      name: 'Temporary Therapist',
      serviceType: 'Pending',
      location: {
        type: 'Point',
        coordinates: [0, 0]
      }
    });

    const savedTherapist = await newTherapist.save();
    console.log('Saved new therapist:', savedTherapist._id);

    return res.status(201).json({
      message: 'Token saved successfully',
      therapistId: savedTherapist._id
    });

  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Token already exists',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to save token',
      details: error.message
    });
  }
});

// Route to verify token
router.get('/verify-token/:token', async (req, res) => {
  try {
    const therapist = await Therapist.findOne({ fcmToken: req.params.token });
    res.json({ exists: !!therapist });
  } catch (error) {
    res.status(500).json({ error: 'Error verifying token' });
  }
});

module.exports = router;
