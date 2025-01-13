const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');

router.post('/fcm/token', async (req, res) => {
  console.log('Received token save request:', req.body);

  try {
    const { fcmToken, userId, role, _id } = req.body;

    if (!fcmToken || !userId || !role) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Update the user's FCM token
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken: fcmToken },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If the user is a therapist, also update or create therapist record
    if (role === 'مقدم_خدمة') {
      let therapist = await Therapist.findOne({ userId: userId });

      if (therapist) {
        therapist.fcmToken = fcmToken;
        await therapist.save();
      } else {
        therapist = new Therapist({
          _id: userId, // Use userId as _id
          userId: userId,
          fcmToken: fcmToken,
          name: updatedUser.name,
          serviceType: 'Pending'
        });
        await therapist.save();
      }

      return res.status(200).json({
        message: 'Token saved successfully',
        therapistId: therapist._id,
        userId: userId
      });
    }

    res.status(200).json({
      message: 'Token saved successfully',
      userId: userId
    });

  } catch (error) {
    console.error('Error saving token:', error);
    res.status(500).json({
      error: 'Failed to save token',
      details: error.message
    });
  }
});

console.log('Attempting to save new therapist...');
const savedTherapist = await newTherapist.save();
console.log('Saved new therapist:', savedTherapist._id);

res.status(201).json({
message: 'Token saved successfully',
therapistId: savedTherapist._id
});

} catch (error) {
console.error('Detailed error:', {
message: error.message,
stack: error.stack,
name: error.name
});

// تحقق من نوع الخطأ
if (error.code === 11000) {
return res.status(409).json({
error: 'Token already exists',
details: error.message
});
}

res.status(500).json({
error: 'Failed to save token',
details: error.message
});
}
});


router.post('/save-fcm-token', async (req, res) => {
const { therapistId, fcmToken } = req.body;
console.log('Received token request:', { therapistId, fcmToken });

try {
// إذا لم يكن هناك معالج محدد، قم بإنشاء وثيقة جديدة لتخزين التوكن
let tokenDoc = await Therapist.findOne({ fcmToken: fcmToken });

if (!tokenDoc) {
tokenDoc = new Therapist({
fcmToken: fcmToken,
// يمكنك إضافة حقول إضافية حسب الحاجة
name: 'Temporary Therapist',
serviceType: 'Pending',
});
}

tokenDoc.fcmToken = fcmToken;
await tokenDoc.save();

res.status(200).json({
message: 'FCM token saved successfully',
therapistId: tokenDoc._id
});
} catch (error) {
console.error('Error saving FCM token:', error);
res.status(500).json({ error: 'Failed to save FCM token' });
}
});

// مسار للتحقق من وجود التوكن
router.get('/verify-token/:token', async (req, res) => {
try {
const therapist = await Therapist.findOne({ fcmToken: req.params.token });
res.json({ exists: !!therapist });
} catch (error) {
res.status(500).json({ error: 'Error verifying token' });
}
});

module.exports = router;
