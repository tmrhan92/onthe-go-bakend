const express = require('express');
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service'); // تأكد من المسار الصحيح
const router = express.Router();

// دالة لتوليد معرف الـ Service
const generateServiceId = (name, serviceType) => {
  const timestamp = Date.now(); // إضافة الطابع الزمني لتجنب التكرار
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${serviceType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
};

// استرجاع جميع الخدمات
router.get('/', async (req, res) => {
  try {
    const { type, minPrice, maxPrice, subCategory } = req.query;
    let query = {};

    if (type) {
      const [serviceType, subCat] = type.split('/');
      query.serviceType = serviceType;
      if (subCat) {
        query.subCategory = subCat;
      }
    }

    if (subCategory) {
      query.subCategory = subCategory;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const services = await Service.find(query);
    if (services.length === 0) {
      return res.status(404).json({ message: "لا توجد خدمات متاحة" });
    }

    res.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ message: "خطأ في تحميل الخدمات" });
  }
});

// إضافة خدمة جديدة
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// إنشاء خدمة جديدة
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      serviceType,
      subCategory,
      therapistId,
      latitude,
      longitude,
      governorate,
      area,
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (
      !name ||
      !description ||
      !price ||
      !duration ||
      !serviceType ||
      !subCategory ||
      !therapistId ||
      !latitude ||
      !longitude ||
      !governorate ||
      !area
    ) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    // إنشاء الخدمة
    const newService = new Service({
      name,
      description,
      price,
      duration,
      serviceType,
      subCategory,
      therapistId,
      latitude,
      longitude,
      governorate,
      area,
    });

    const savedService = await newService.save();
    res.status(201).json(savedService);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
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
    console.error("Error fetching service details:", error);
    res.status(500).json({ message: 'خطأ في تحميل تفاصيل الخدمة' });
  }
});

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
    console.error("Error fetching services by type:", error);
    res.status(500).json({ message: 'خطأ في تحميل الخدمات' });
  }
});

module.exports = router;
