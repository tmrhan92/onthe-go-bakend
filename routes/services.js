const express = require('express');
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const Therapist = require('../models/Therapist');
const admin = require('firebase-admin'); // استيراد firebase-admin
const User = require('../models/User');


// تهيئة Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('path/to/your/serviceAccountKey.json'); // المسار إلى ملف مفاتيح الخدمة
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const router = express.Router();


// دالة لتوليد معرف الـ Service
const generateServiceId = (name, serviceType) => {
  const timestamp = Date.now(); // إضافة الطابع الزمني لتجنب التكرار
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${serviceType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
};

// استرجاع جميع الخدمات مع التصفية حسب المحافظة والمنطقة
router.get('/', async (req, res) => {
  try {
    const { type, minPrice, maxPrice, subCategory, province, area,minHours, maxHours } = req.query;
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

    const { name, description, serviceType, price, duration, subCategory, latitude, longitude, therapistId, province, area } = req.body;

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
        subCategory,
        latitude,
        longitude,
        therapistId,
        province, // إضافة المحافظة
        area, // إضافة المنطقة
        hoursRequired: 5, // تأكد من تعيين قيمة صحيحة هنا

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
  const { province, area } = req.query;

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


// طلب خدمة من مقدم خدمة آخر
router.post('/request-service', async (req, res) => {
  try {
    const { serviceId, requestedBy, hoursRequired } = req.body;

    // التحقق من وجود الخدمة والمستخدم
    const service = await Service.findById(serviceId);
    const requestingUser = await User.findById(requestedBy);
    const serviceProvider = await User.findById(service.therapistId);

    if (!service || !requestingUser || !serviceProvider) {
      return res.status(404).json({ message: 'الخدمة أو المستخدم غير موجود' });
    }

    // التحقق من أن المستخدم لا يطلب خدمة من نفسه
    if (service.therapistId.toString() === requestedBy) {
      return res.status(400).json({ message: 'لا يمكنك طلب خدمة من نفسك' });
    }

    // التحقق من رصيد الوقت
    if (requestingUser.timeBalance < hoursRequired) {
      return res.status(400).json({ message: 'رصيد الوقت غير كافٍ' });
    }

    // خصم الساعات من رصيد المستخدم الذي يطلب الخدمة
    requestingUser.spentHours += hoursRequired;
    requestingUser.timeBalance -= hoursRequired;
    await requestingUser.save();

    // إضافة الساعات إلى رصيد مقدم الخدمة الذي تم طلب خدمته
    serviceProvider.earnedHours += hoursRequired;
    serviceProvider.timeBalance += hoursRequired;
    await serviceProvider.save();

    // تحديث حالة الخدمة
    service.requestedBy = requestedBy;
    service.status = 'ongoing';
    await service.save();

    // إرسال إشعار Firebase إلى مقدم الخدمة
    if (serviceProvider.fcmToken) {
      const message = {
        notification: {
          title: 'طلب خدمة جديد',
          body: `تم طلب خدمتك: ${service.name}`,
        },
        token: serviceProvider.fcmToken,
      };

      await admin.messaging().send(message);
    }

    res.status(200).json({
      message: 'تم طلب الخدمة بنجاح',
      remainingTimeBalance: requestingUser.timeBalance,
    });
  } catch (error) {
    console.error('Error in request-service:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء طلب الخدمة' });
  }
});

// جلب الطلبات التي تمت على مقدم الخدمة
router.get('/therapist-requests/:therapistId', async (req, res) => {
  try {
    const { therapistId } = req.params;

    // جلب الخدمات التي طلبها مقدمي خدمات آخرون
    const requests = await Service.find({
      therapistId,
      requestedBy: { $ne: null },
    }).populate('requestedBy', 'name email phone');

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching therapist requests:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الطلبات' });
  }
});

router.get('/:userId/time-balance', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({ timeBalance: user.timeBalance });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في النظام' });
  }
});

router.post('/:userId/update-time-balance', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { timeBalance } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    user.timeBalance = timeBalance;
    await user.save();
    res.json({ message: 'تم تحديث الرصيد الزمني بنجاح', timeBalance: user.timeBalance });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في النظام' });
  }
});

module.exports = router;
