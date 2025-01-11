const express = require('express');
const Service = require('../models/Service'); // تأكد من المسار الصحيح
const router = express.Router();

// دالة لتوليد معرف الـ Service
const generateServiceId = (name, serviceType) => {
return `${name.toLowerCase().replace(/\s+/g, '_')}_${serviceType.toLowerCase().replace(/\s+/g, '_')}`;
};

// استرجاع جميع الخدمات
router.get('/', async (req, res) => {
try {
const { type } = req.query;
let query = {};

if (type) {
const [serviceType, subCategory] = type.split('/'); // تقسيم النوع إلى النوع الفرعي والفئة الفرعية
query.serviceType = serviceType;
if (subCategory) {
query.subCategory = subCategory; // إذا كان هناك فئة فرعية، أضفها إلى الاستعلام
}
}

const services = await Service.find(query);
if (services.length === 0) {
return res.status(404).json({ message: "لا توجد خدمات متاحة" });
}

res.json(services);
} catch (error) {
res.status(500).json({ message: "خطأ في تحميل الخدمات" });
}
});

// إضافة خدمة جديدة
router.post('/', async (req, res) => {
  const { name, description, serviceType, price, duration, subCategory, latitude, longitude, therapistId } = req.body;

  if (!name || !description || !serviceType || !price || !duration || !subCategory || !latitude || !longitude || !therapistId) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }

  const _id = generateServiceId(name, serviceType);

  const service = new Service({
    _id,
    name,
    description,
    serviceType,
    price,
    duration,
    subCategory,
    latitude,
    longitude,
    therapistId, 
  });

  try {
    await service.save();
    res.status(201).json(service);
  } catch (error) {
    console.error("Error while adding service:", error);
    res.status(500).json({ message: "فشل في إضافة الخدمة" });
  }
});
// الحصول على تفاصيل خدمة معينة
router.get('/:serviceId', async (req, res) => {
  const { serviceId } = req.params;
  try {
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'الخدمة غير موجودة' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تحميل تفاصيل الخدمة' });
  }
});

// routes/services.js

// الحصول على الخدمات حسب النوع
router.get('/:serviceType', async (req, res) => {
  const serviceType = decodeURIComponent(req.params.serviceType); // فك ترميز URL
  try {
    const services = await Service.find({ serviceType });
    if (services.length === 0) {
      return res.status(404).json({ message: 'لا توجد خدمات متاحة' });
    }
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تحميل الخدمات' });
  }
});


module.exports = router;
