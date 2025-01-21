const express = require('express');
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const User = require('../models/User'); // استيراد نموذج المستخدم
const router = express.Router();

// دالة لتوليد معرف الـ Service
const generateServiceId = (name, serviceType) => {
  const timestamp = Date.now(); // إضافة الطابع الزمني لتجنب التكرار
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${serviceType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
};

// استرجاع جميع الخدمات مع التصفية حسب المحافظة والمنطقة
router.get('/', async (req, res) => {
  try {
    const { type, minPrice, maxPrice, subCategory, province, area, minHours, maxHours } = req.query;
    let query = {};

    // شرط أساسي: يجب توفر المحافظة والمنطقة
    if (!province || !area) {
      return res.status(400).json({ 
        message: "يجب تحديد المحافظة والمنطقة للبحث عن الخدمات" 
      });
    }

    // إضافة شروط الموقع دائماً للاستعلام
    query.province = province;
    query.area = area;

    // إضافة باقي شروط البحث
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

    if (minHours || maxHours) {
      query.hoursRequired = {};
      if (minHours) query.hoursRequired.$gte = parseFloat(minHours);
      if (maxHours) query.hoursRequired.$lte = parseFloat(maxHours);
    }

    const services = await Service.find(query);
    
    if (services.length === 0) {
      return res.status(404).json({ 
        message: `لا توجد خدمات متاحة في ${area}, ${province}` 
      });
    }

    res.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ message: "خطأ في تحميل الخدمات" });
  }
});

// إضافة خدمة جديدة
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('الاسم مطلوب'),
    body('description').notEmpty().withMessage('الوصف مطلوب'),
    body('serviceType').notEmpty().withMessage('نوع الخدمة مطلوب'),
    body('price').isNumeric().withMessage('السعر يجب أن يكون رقماً'),
    body('duration').isNumeric().withMessage('المدة يجب أن تكون رقماً'),
    body('hoursRequired').isNumeric().withMessage('عدد الساعات المطلوبة يجب أن يكون رقماً'),
    body('subCategory').notEmpty().withMessage('الفئة الفرعية مطلوبة'),
    body('latitude').isNumeric().withMessage('خط الطول يجب أن يكون رقماً'),
    body('longitude').isNumeric().withMessage('خط العرض يجب أن يكون رقماً'),
    body('therapistId').notEmpty().withMessage('معرف المعالج مطلوب'),
    body('province').notEmpty().withMessage('المحافظة مطلوبة'), // التحقق من المحافظة
    body('area').notEmpty().withMessage('المنطقة مطلوبة'), // التحقق من المنطقة
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, serviceType, price, duration, hoursRequired, subCategory, latitude, longitude, therapistId, province, area } = req.body;

    const _id = generateServiceId(name, serviceType);

    try {
      const existingService = await Service.findById(_id);
      if (existingService) {
        return res.status(400).json({ message: "الخدمة موجودة مسبقاً" });
      }

      const service = new Service({
        _id,
        name,
        description,
        serviceType,
        price,
        duration,
        hoursRequired,
        subCategory,
        latitude,
        longitude,
        therapistId,
        province, // إضافة المحافظة
        area, // إضافة المنطقة
      });

      await service.save();
      res.status(201).json(service);
    } catch (error) {
      console.error("Error while adding service:", error);
      res.status(500).json({ message: "فشل في إضافة الخدمة" });
    }
  }
);

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
  const serviceType = decodeURIComponent(req.params.serviceType);
  const { province, area, minHours, maxHours } = req.query;

  // التحقق من وجود المحافظة والمنطقة
  if (!province || !area) {
    return res.status(400).json({ 
      message: "يجب تحديد المحافظة والمنطقة للبحث عن الخدمات" 
    });
  }

  const query = { 
    serviceType,
    province,
    area
  };

  if (minHours || maxHours) {
    query.hoursRequired = {};
    if (minHours) query.hoursRequired.$gte = parseFloat(minHours);
    if (maxHours) query.hoursRequired.$lte = parseFloat(maxHours);
  }

  try {
    const services = await Service.find(query);
    if (services.length === 0) {
      return res.status(404).json({ 
        message: `لا توجد خدمات متاحة من نوع ${serviceType} في ${area}, ${province}` 
      });
    }
    res.json(services);
  } catch (error) {
    console.error("Error fetching services by type:", error);
    res.status(500).json({ message: 'خطأ في تحميل الخدمات' });
  }
});

// تحديث الرصيد الزمني بعد اكتمال الخدمة
router.post('/:serviceId/complete', async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.body;

  try {
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'الخدمة غير موجودة' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // خصم الساعات من رصيد المستخدم
    if (user.timeBalance < service.hoursRequired) {
      return res.status(400).json({ message: 'رصيدك الزمني غير كافي' });
    }

    user.timeBalance -= service.hoursRequired;
    await user.save();

    // إضافة الساعات إلى رصيد مقدم الخدمة
    const therapist = await User.findById(service.therapistId);
    if (therapist) {
      therapist.timeBalance += service.hoursRequired;
      await therapist.save();
    }

    res.json({ message: 'تم اكتمال الخدمة بنجاح', user, therapist });
  } catch (error) {
    console.error("Error completing service:", error);
    res.status(500).json({ message: 'خطأ في اكتمال الخدمة' });
  }
});

module.exports = router;
