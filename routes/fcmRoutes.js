const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');

router.post('/fcm/token', async (req, res) => {
console.log('Received token save request:', req.body);

try {
const { fcmToken, name = 'Pending Registration', serviceType = 'Pending' } = req.body;

if (!fcmToken) {
console.log('No token provided');
return res.status(400).json({ error: 'FCM token is required' });
}

// البحث عن معالج موجود بنفس التوكن
let existingTherapist = await Therapist.findOne({ fcmToken });

if (existingTherapist) {
console.log('Found existing therapist:', existingTherapist._id);
return res.status(200).json({
message: 'Token already exists',
therapistId: existingTherapist._id
});
}

// إنشاء معالج جديد
const newTherapist = new Therapist({
fcmToken,
name,
serviceType,
location: {
type: 'Point',
coordinates: [0, 0] // قيمة افتراضية للإحداثيات
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
