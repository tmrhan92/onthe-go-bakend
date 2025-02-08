const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const User = require('../models/User');
const admin = require('firebase-admin');

// تهيئة Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('path/to/your/serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const router = express.Router();

// دالة لتوليد معرف الـ Service
const generateServiceId = (name, serviceType) => {
  const timestamp = Date.now();
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${serviceType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
};

// استرجاع جميع الخدمات مع التصفية
router.get('/', async (req, res) => {
  try {
    const { type, minPrice, maxPrice, subCategory, province, area, minHours, maxHours } = req.query;
    let query = {};

    if (!province || !area) {
      return res.status(400).json({ 
        message: "يجب تحديد المحافظة والمنطقة للبحث عن الخدمات" 
      });
    }

    query.province = province;
    query.area = area;
    query.status = 'available'; // إضافة فحص حالة الخدمة

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

    const services = await Service.find(query).populate('therapistId', 'name rating');
    
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
    body('name').trim().notEmpty().withMessage('الاسم مطلوب'),
    body('description').trim().notEmpty().withMessage('الوصف مطلوب'),
    body('serviceType').trim().notEmpty().withMessage('نوع الخدمة مطلوب'),
    body('price').isFloat({ min: 0 }).withMessage('السعر يجب أن يكون رقماً موجباً'),
    body('duration').isInt({ min: 1 }).withMessage('المدة يجب أن تكون رقماً موجباً'),
    body('subCategory').trim().notEmpty().withMessage('الفئة الفرعية مطلوبة'),
    body('latitude').isFloat().withMessage('خط العرض يجب أن يكون رقماً صحيحاً'),
    body('longitude').isFloat().withMessage('خط الطول يجب أن يكون رقماً صحيحاً'),
    body('therapistId').trim().notEmpty().withMessage('معرف المعالج مطلوب'),
    body('province').trim().notEmpty().withMessage('المحافظة مطلوبة'),
    body('area').trim().notEmpty().withMessage('المنطقة مطلوبة'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'بيانات غير صحيحة',
        errors: errors.array() 
      });
    }

    const { 
      name, description, serviceType, price, duration, 
      subCategory, latitude, longitude, therapistId, province, area 
    } = req.body;

    const _id = generateServiceId(name, serviceType);

    try {
      // التحقق من وجود المعالج
      const therapist = await User.findById(therapistId);
      if (!therapist) {
        return res.status(404).json({ message: "المعالج غير موجود" });
      }

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
        province,
        area,
        status: 'available'
      });

      await service.save();
      res.status(201).json(service);
    } catch (error) {
      console.error("Error while adding service:", error);
      res.status(500).json({ message: "فشل في إضافة الخدمة" });
    }
  }
);

// طلب خدمة
router.post(
  '/request-service',
  [
    body('serviceId').trim().notEmpty().withMessage('معرف الخدمة مطلوب'),
    body('requestedBy').trim().notEmpty().withMessage('معرف المستخدم مطلوب'),
    body('hoursRequired').isFloat({ min: 0.1 }).withMessage('عدد الساعات يجب أن يكون رقماً موجباً'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      console.log('Request body:', req.body);
      return res.status(400).json({ 
        message: 'بيانات غير صحيحة',
        errors: errors.array() 
      });
    }

    try {
      const { serviceId, requestedBy, hoursRequired } = req.body;

      console.log('Request data:', { serviceId, requestedBy, hoursRequired });

      // التحقق من وجود الخدمة
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ message: 'الخدمة غير موجودة' });
      }

      // التحقق من حالة الخدمة
      if (service.status !== 'available') {
        return res.status(400).json({ message: 'الخدمة غير متاحة حالياً' });
      }

      // التحقق من وجود المستخدم
      const user = await User.findById(requestedBy);
      if (!user) {
        return res.status(404).json({ message: 'المستخدم غير موجود' });
      }

      // التحقق من أن المستخدم لا يطلب خدمة من نفسه
      if (service.therapistId.toString() === requestedBy) {
        return res.status(400).json({ message: 'لا يمكنك طلب خدمة من نفسك' });
      }

      // التحقق من رصيد الوقت
      if (user.timeBalance < hoursRequired) {
        return res.status(400).json({ 
          message: 'رصيد الوقت غير كافٍ',
          currentBalance: user.timeBalance,
          required: hoursRequired
        });
      }

      // خصم الوقت من رصيد المستخدم
      user.timeBalance -= hoursRequired;
      await user.save();

      // تحديث حالة الخدمة
      service.requestedBy = requestedBy;
      service.status = 'ongoing';
      service.hoursRequired = hoursRequired;
      await service.save();

      // إرسال إشعار Firebase إلى مقدم الخدمة
      const therapist = await User.findById(service.therapistId);
      if (therapist && therapist.fcmToken) {
        const message = {
          notification: {
            title: 'طلب خدمة جديد',
            body: `تم طلب خدمتك: ${service.name}`,
          },
          data: {
            serviceId: service._id,
            requestedBy: requestedBy,
            hoursRequired: hoursRequired.toString(),
            serviceName: service.name
          },
          token: therapist.fcmToken,
        };

        try {
          await admin.messaging().send(message);
          console.log('Notification sent successfully');
        } catch (error) {
          console.error('Error sending notification:', error);
        }
      }

      res.status(200).json({
        message: 'تم طلب الخدمة بنجاح',
        remainingTimeBalance: user.timeBalance,
        service: {
          id: service._id,
          name: service.name,
          hoursRequired: hoursRequired,
          status: service.status
        }
      });
    } catch (error) {
      console.error('Error in request-service:', error);
      res.status(500).json({ message: 'حدث خطأ أثناء طلب الخدمة' });
    }
  }
);

// جلب الطلبات الواردة لمقدم الخدمة
router.get('/therapist-requests/:therapistId', async (req, res) => {
  try {
    const { therapistId } = req.params;
    const { status } = req.query;

    let query = {
      therapistId,
      requestedBy: { $ne: null }
    };

    if (status) {
      query.status = status;
    }

    const requests = await Service.find(query)
      .populate('requestedBy', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching therapist requests:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الطلبات' });
  }
});

// تحديث حالة الخدمة
router.patch('/:serviceId/status', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    if (!['available', 'ongoing', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'حالة غير صالحة' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'الخدمة غير موجودة' });
    }

    service.status = status;
    await service.save();

    // إرسال إشعار للمستخدم إذا تم إكمال الخدمة
    if (status === 'completed' && service.requestedBy) {
      const user = await User.findById(service.requestedBy);
      if (user && user.fcmToken) {
        const message = {
          notification: {
            title: 'تم إكمال الخدمة',
            body: `تم إكمال الخدمة: ${service.name}`,
          },
          token: user.fcmToken,
        };

        try {
          await admin.messaging().send(message);
        } catch (error) {
          console.error('Error sending completion notification:', error);
        }
      }
    }

    res.json({
      message: 'تم تحديث حالة الخدمة بنجاح',
      service: {
        id: service._id,
        status: service.status,
        name: service.name
      }
    });
  } catch (error) {
    console.error('Error updating service status:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث حالة الخدمة' });
  }
});

module.exports = router;
