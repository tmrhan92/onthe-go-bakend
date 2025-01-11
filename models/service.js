// models/Service.js
const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
_id: {
type: String, // تعريف _id كسلسلة
required: true,
},
name: { type: String, required: true },
description: { type: String, required: true },
serviceType: { type: String, required: true },
price: { type: Number, required: true },
duration: { type: Number, required: true },
subCategory: { type: String, required: true }, // إضافة حقل الفئة الفرعية
latitude: { type: Number, required: true },   // إحداثيات خط العرض
longitude: { type: Number, required: true } ,   // إحداثيات خط الطول
therapistId: { type: String,  required: true }, // _id للخدمة

});


module.exports = mongoose.model('Service', ServiceSchema);
