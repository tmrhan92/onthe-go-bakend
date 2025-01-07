const express = require('express');
const User = require('../models/User');
const Therapist = require('../models/Therapist');
const router = express.Router();

// استرجاع جميع المستخدمين
router.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// حذف مستخدم
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.send("تم حذف المستخدم بنجاح");
});

// استرجاع جميع المعالجين
router.get('/therapists', async (req, res) => {
  const therapists = await Therapist.find();
  res.json(therapists);
});

// إضافة معالج جديد
router.post('/therapists', async (req, res) => {
  const { name, serviceType, bio } = req.body;
  const newTherapist = new Therapist({ name, serviceType, bio });
  await newTherapist.save();
  res.status(201).send("تم إضافة المعالج بنجاح");
});






// حذف معالج
router.delete('/therapists/:id', async (req, res) => {
  await Therapist.findByIdAndDelete(req.params.id);
  res.send("تم حذف المعالج بنجاح");
});

module.exports = router;
