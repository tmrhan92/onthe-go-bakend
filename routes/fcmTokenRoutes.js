// fcmTokenRoutes.js
const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');

// مسار حفظ توكن FCM
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
