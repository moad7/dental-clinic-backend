// src/controllers/treatmentController.js
import Treatment from '../../models/Treatment.js';
import User from '../../models/User.js';
import Service from '../../models/Service.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import mongoose from 'mongoose';
import { getDateOnlyRange, isValidTime } from '../utils/fuctions.js';

function currentUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.sub;
}
export const createTreatmentSession = async (req, res) => {
  try {
    const { treatmentId } = req.params;

    const {
      doctorId,
      date,
      time,
      sessionStatus = 'pending',
      note = '',
    } = req.body;

    const createdBy = req.user.userId;
    const createdByRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(treatmentId)) {
      return res.status(400).json({
        message: 'Invalid treatmentId',
      });
    }
    if (!date || !time) {
      return res.status(400).json({
        message: 'Date and time are required',
      });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({
        message: 'Invalid time format. Expected HH:mm',
      });
    }

    const allowedStatuses = ['pending', 'confirmed'];

    if (!allowedStatuses.includes(sessionStatus)) {
      return res.status(400).json({
        message: 'New treatment session must be pending or confirmed',
      });
    }

    // 1. العلاج
    const treatment = await Treatment.findById(treatmentId);

    if (!treatment) {
      return res.status(404).json({
        message: 'Treatment not found',
      });
    }

    if (treatment.status !== 'in_progress') {
      return res.status(400).json({
        message: 'Cannot add sessions to a treatment that is not in progress',
      });
    }

    // 2. عدد الجلسات الموجودة
    const currentSessionsCount = await TreatmentSession.countDocuments({
      treatmentId: treatment._id,
    });

    if (currentSessionsCount >= treatment.totalSessions) {
      return res.status(400).json({
        message: 'All treatment sessions are already scheduled',
      });
    }

    // 3. أول جلسة من العلاج
    const firstSession = await TreatmentSession.findOne({
      treatmentId: treatment._id,
    }).sort({
      createdAt: 1,
    });

    if (!firstSession) {
      return res.status(404).json({
        message: 'First treatment session not found',
      });
    }

    // 4. تأكد أن الطبيب ما زال فعال
    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isActive: true,
      'doctor.services.groupId': treatment.serviceGroupId,
    });

    if (!doctor) {
      return res.status(400).json({
        message:
          'Treatment doctor is inactive or no longer provides this service',
      });
    }

    // 5. التاريخ
    const dateRange = date;

    if (!dateRange) {
      return res.status(400).json({
        message: 'Invalid date',
      });
    }

    // 6. تعارض الطبيب
    const doctorConflict = await TreatmentSession.exists({
      doctorId,
      time,
      status: {
        $in: ['pending', 'confirmed'],
      },
      date: {
        $gte: dateRange.start,
        $lt: dateRange.end,
      },
    });

    if (doctorConflict) {
      return res.status(409).json({
        message: 'Doctor already has an appointment at this date and time',
      });
    }

    // 7. منع المريض من وجود موعد آخر بنفس اليوم
    const patientTreatments = await Treatment.find({
      userId: treatment.userId,
      status: {
        $ne: 'completed',
      },
    }).select('_id');

    const patientTreatmentIds = patientTreatments.map((item) => item._id);

    const patientConflict = await TreatmentSession.exists({
      treatmentId: {
        $in: patientTreatmentIds,
      },
      status: {
        $in: ['pending', 'confirmed'],
      },
      date: {
        $gte: dateRange.start,
        $lt: dateRange.end,
      },
    });

    if (patientConflict) {
      return res.status(409).json({
        message: 'Patient already has an appointment on this day',
      });
    }

    // 8. إنشاء الجلسة الجديدة
    const newSession = await TreatmentSession.create({
      treatmentId: treatment._id,
      doctorId,
      date: new Date(date),
      time,
      status: sessionStatus,
      note,
      createdBy,
      createdByRole,
    });

    const sessionsCount = currentSessionsCount + 1;

    return res.status(201).json({
      message: 'Treatment session created successfully',
      session: newSession,
      treatment: {
        _id: treatment._id,
        totalSessions: treatment.totalSessions,
        scheduledSessions: sessionsCount,
        remainingSessions: Math.max(treatment.totalSessions - sessionsCount, 0),
      },
    });
  } catch (error) {
    console.error('createTreatmentSession error:', error);

    return res.status(500).json({
      message: 'Failed to create treatment session',
      error: error.message,
    });
  }
};

export const getTreatmentSessions = async (req, res) => {
  try {
    const { treatmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(treatmentId)) {
      return res.status(400).json({
        message: 'Invalid treatmentId',
      });
    }

    const treatment = await Treatment.findById(treatmentId)
      .populate({
        path: 'userId',
        select: 'name phoneNumber',
      })
      .populate({
        path: 'serviceGroupId',
        select: 'title services',
      })
      .lean();

    if (!treatment) {
      return res.status(404).json({
        message: 'Treatment not found',
      });
    }

    const sessions = await TreatmentSession.find({
      treatmentId,
    })
      .populate({
        path: 'doctorId',
        select: 'name phoneNumber',
      })
      .populate({
        path: 'createdBy',
        select: 'name role',
      })
      .sort({
        date: 1,
        time: 1,
      })
      .lean();

    const scheduledSessions = sessions.length;

    return res.status(200).json({
      treatment,
      sessions,

      statistics: {
        totalSessions: treatment.totalSessions,
        scheduledSessions,
        remainingSessions: Math.max(
          treatment.totalSessions - scheduledSessions,
          0,
        ),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch treatment sessions',
      error: error.message,
    });
  }
};

// POST /api/treatments
export const createTreatment = async (req, res) => {
  const { userId, serviceId, totalSessions, note } = req.body;

  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res
      .status(403)
      .json({ message: 'Only secretaries or doctors can create treatments' });
  }
  if (!userId || !serviceId || !totalSessions) {
    return res
      .status(400)
      .json({ message: 'userId, serviceId and totalSessions are required' });
  }

  try {
    const treatment = await Treatment.create({
      userId,
      serviceId,
      totalSessions: Number(totalSessions),
      note,
    });

    res
      .status(201)
      .json({ message: 'Treatment created successfully', treatment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create treatment', error: err.message });
  }
};

// GET /api/treatments
export const getAllTreatments = async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'secretary') {
    return res.status(403).json({ message: 'Unauthorized to view treatments' });
  }

  try {
    const treatments = await Treatment.find({})
      .populate({ path: 'userId', select: 'id name phoneNumber', model: User }) // as: patient
      .populate({ path: 'serviceId', select: 'id name price', model: Service })
      .sort({ createdAt: -1 })
      .lean();

    // لمواءمة alias القديمة (as: 'patient')
    const mapped = treatments.map((t) => ({
      ...t,
      patient: t.userId,
    }));

    res.status(200).json(mapped);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch treatments', error: err.message });
  }
};

// GET /api/treatments/mine
export const getMyTreatments = async (req, res) => {
  if (req.user.role !== 'patient') {
    return res
      .status(403)
      .json({ message: 'Only patients can access their own treatments' });
  }

  try {
    const me = currentUserId(req);
    const treatments = await Treatment.find({ userId: me })
      .populate({ path: 'serviceId', model: Service }) // كل تفاصيل الخدمة
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(treatments);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch treatments', error: err.message });
  }
};

// PUT /api/treatments/:id
export const updateTreatment = async (req, res) => {
  const { id } = req.params;
  const { totalSessions, note, status, serviceId } = req.body;

  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res
      .status(403)
      .json({ message: 'Only secretaries or doctors can update treatments' });
  }

  try {
    const treatment = await Treatment.findById(id);
    if (!treatment)
      return res.status(404).json({ message: 'Treatment not found' });

    if (totalSessions !== undefined)
      treatment.totalSessions = Number(totalSessions);
    if (note !== undefined) treatment.note = note;
    if (status !== undefined) treatment.status = status;
    if (serviceId !== undefined) treatment.serviceId = serviceId;

    await treatment.save();

    res
      .status(200)
      .json({ message: 'Treatment updated successfully', treatment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update treatment', error: err.message });
  }
};
