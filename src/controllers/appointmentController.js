import mongoose from 'mongoose';
import Appointment from '../../models/Appointment.js';
import User from '../../models/User.js';
import {
  CONFLICT_STATUSES,
  getDateOnlyRange,
  isValidTime,
} from '../utils/fuctions.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import Treatment from '../../models/Treatment.js';

function currentUserId(req) {
  return req.user?._id;
}

export const createAppointment = async (req, res) => {
  try {
    const payload = req.body;

    const {
      patientId: bodyPatientId,
      doctorId,
      serviceGroupId,
      serviceItemId,
      requiresMultipleSessions,
      totalSessions,
      session,
      note,
    } = payload || {};

    const createdByRole = req.user.role;
    const createdBy = req.user.userId;

    const patientId =
      createdByRole === 'secretary' ? bodyPatientId : req.user.userId;

    if (
      !patientId ||
      !doctorId ||
      !serviceGroupId ||
      !serviceItemId ||
      !session?.date ||
      !session?.time
    ) {
      return res.status(400).json({
        message: 'Missing required fields',
      });
    }

    if (!isValidTime(session.time)) {
      return res.status(400).json({
        message: 'Invalid time format. Expected HH:mm',
      });
    }

    const ids = [patientId, doctorId, createdBy, serviceGroupId, serviceItemId];

    const invalidId = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));

    if (invalidId) {
      return res.status(400).json({
        message: 'Invalid ObjectId',
        invalidId,
      });
    }

    const patient = await User.findOne({
      _id: patientId,
      role: 'patient',
    });

    if (!patient) {
      return res.status(404).json({
        message: 'Patient not found',
      });
    }

    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isActive: true,
      'doctor.services.groupId': serviceGroupId,
    });

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found or does not provide this service',
      });
    }

    const dateRange = getDateOnlyRange(session.date);

    if (!dateRange) {
      return res.status(400).json({
        message: 'Invalid session date',
      });
    }

    const doctorConflict = await TreatmentSession.exists({
      doctorId,
      time: session.time,
      status: { $in: ['pending', 'confirmed'] },
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

    const patientTreatments = await Treatment.find({
      userId: patientId,
      status: { $ne: 'completed' },
    }).select('_id');

    const treatmentIds = patientTreatments.map((t) => t._id);

    if (treatmentIds.length > 0) {
      const patientSameDaySession = await TreatmentSession.exists({
        treatmentId: { $in: treatmentIds },
        status: { $ne: 'completed' },
        date: {
          $gte: dateRange.start,
          $lt: dateRange.end,
        },
      });

      if (patientSameDaySession) {
        return res.status(409).json({
          message:
            'Patient already has an appointment on this day. Complete the existing appointment first.',
        });
      }
    }

    const sessionsCount = requiresMultipleSessions ? Number(totalSessions) : 1;

    if (!sessionsCount || sessionsCount < 1) {
      return res.status(400).json({
        message: 'totalSessions must be at least 1',
      });
    }

    const treatment = await Treatment.create({
      userId: patientId,
      serviceGroupId,
      serviceItemId,
      totalSessions: sessionsCount,
      note,
      status: 'in_progress',
      createdBy,
      createdByRole,
    });

    const treatmentSession = await TreatmentSession.create({
      treatmentId: treatment._id,
      doctorId,
      date: new Date(session.date),
      time: session.time,
      status: session.status || 'pending',
      note: session.note,
      createdBy,
      createdByRole,
    });

    return res.status(201).json({
      message: 'Appointment created successfully',
      treatment,
      session: treatmentSession,
    });
  } catch (error) {
    console.error('createAppointment error:', error);

    return res.status(500).json({
      message: 'Failed to create appointment',
      error: error.message,
    });
  }
};

// GET /api/appointments/
export const getAllAppointments = async (req, res) => {
  try {
    const appointments = await TreatmentSession.find()
      .populate({
        path: 'doctorId',
        select: 'name phoneNumber',
      })
      .populate({
        path: 'createdBy',
        select: 'name role',
      })
      .populate({
        path: 'treatmentId',
        select: 'userId serviceGroupId serviceItemId totalSessions status',
        populate: [
          {
            path: 'userId',
            select: 'name phoneNumber',
          },
          {
            path: 'serviceGroupId',
            select: 'title services',
          },
        ],
      })
      .sort({ date: -1, time: 1 })
      .lean();

    const normalizedAppointments = appointments.map((appt) => {
      const treatment = appt.treatmentId;
      const group = treatment?.serviceGroupId;

      const serviceItem =
        group?.services?.find(
          (s) => s._id.toString() === treatment?.serviceItemId?.toString(),
        ) || null;

      if (group?.services) {
        delete group.services;
      }

      return {
        ...appt,
        treatmentId: {
          ...treatment,
          serviceItemId: serviceItem,
        },
      };
    });

    return res.status(200).json({
      count: normalizedAppointments.length,
      appointments: normalizedAppointments,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch appointments',
      error: error.message,
    });
  }
};

// export const updateAppointment = async (req, res) => {
//   const { id } = req.params;
//   const { date, time, note, status } = req.body;

//   try {
//     const appointment = await req.db.Appointment.findByPk(id);
//     if (!appointment)
//       return res.status(404).json({ message: 'Appointment not found' });

//     const isPatient =
//       req.user.role === 'patient' && req.user.userId === appointment.userId;
//     const isSecretary = req.user.role === 'secretary';

//     if (!isPatient && !isSecretary) {
//       return res
//         .status(403)
//         .json({ message: 'Unauthorized to update this appointment' });
//     }

//     if (date !== undefined) appointment.date = date;
//     if (time !== undefined) appointment.time = time;
//     if (note !== undefined) appointment.note = note;
//     if (status !== undefined) appointment.status = status;

//     await appointment.save();
//     res
//       .status(200)
//       .json({ message: 'Appointment updated successfully', appointment });
//   } catch (err) {
//     console.error(err);

//     res
//       .status(500)
//       .json({ message: 'Failed to update appointment', error: err.message });
//   }
// };

// PUT /api/appointments/:id
// export const updateAppointment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { date, time, note, status } = req.body;

//     const appointment = await Appointment.findById(id);
//     if (!appointment)
//       return res.status(404).json({ message: 'Appointment not found' });

//     const isPatient =
//       req.user.role === 'patient' &&
//       String(currentUserId(req)) === String(appointment.userId);
//     const isSecretary = req.user.role === 'secretary';

//     if (!isPatient && !isSecretary) {
//       return res
//         .status(403)
//         .json({ message: 'Unauthorized to update this appointment' });
//     }

//     if (date !== undefined) {
//       const d = new Date(date);
//       appointment.date = new Date(
//         Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
//       );
//     }
//     if (time !== undefined) appointment.time = time;
//     if (note !== undefined) appointment.note = note;
//     if (status !== undefined) appointment.status = status;

//     // لو غيّرنا التاريخ/الوقت، نتأكد من التوفر
//     if (
//       (date !== undefined || time !== undefined) &&
//       appointment.status !== 'cancelled'
//     ) {
//       const clash = await Appointment.findOne({
//         _id: { $ne: appointment._id },
//         date: appointment.date,
//         time: appointment.time,
//         status: { $ne: 'cancelled' },
//       }).lean();
//       if (clash)
//         return res.status(409).json({ message: 'Time is not available' });
//     }

//     await appointment.save();
//     res
//       .status(200)
//       .json({ message: 'Appointment updated successfully', appointment });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to update appointment', error: err.message });
//   }
// };

// DELETE /api/appointments/:id
// export const deleteAppointment = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const appointment = await Appointment.findById(id);
//     if (!appointment)
//       return res.status(404).json({ message: 'Appointment not found' });

//     const isPatient =
//       req.user.role === 'patient' &&
//       String(currentUserId(req)) === String(appointment.userId);
//     const isSecretary = req.user.role === 'secretary';

//     if (!isPatient && !isSecretary) {
//       return res
//         .status(403)
//         .json({ message: 'Unauthorized to delete this appointment' });
//     }

//     await Appointment.deleteOne({ _id: id });
//     res.status(200).json({ message: 'Appointment deleted successfully' });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to delete appointment', error: err.message });
//   }
// };

// GET /api/appointments
// export const getAllAppointments = async (req, res) => {
//   if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
//     return res.status(403).json({ message: 'Unauthorized' });
//   }
//   try {
//     const appointments = await Appointment.find({})
//       .populate({ path: 'userId', select: 'name phoneNumber', model: User })
//       .sort({ date: 1, time: 1 })
//       .lean();

//     // إعادة تسمية بسيطة لمواءمة "as: 'patient'"
//     const mapped = appointments.map((a) => ({
//       ...a,
//       patient: a.userId, // alias
//       userId: a.userId?._id || a.userId,
//     }));

//     res.status(200).json(mapped);
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to fetch appointments', error: err.message });
//   }
// };

// GET /api/appointments/mine
// export const getMyAppointments = async (req, res) => {
//   try {
//     const myId = currentUserId(req);
//     const appointments = await Appointment.find({ userId: myId })
//       .sort({ date: 1, time: 1 })
//       .lean();
//     res.status(200).json(appointments);
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to fetch appointments', error: err.message });
//   }
// };

// GET /api/appointments/today
// export const getTodayAppointments = async (req, res) => {
//   try {
//     const now = new Date();
//     const start = new Date(
//       Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
//     ); // 00:00 UTC
//     const end = new Date(
//       Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
//     ); // +1 يوم

//     const appointments = await Appointment.find({
//       date: { $gte: start, $lt: end },
//       status: { $ne: 'cancelled' },
//     })
//       .populate({ path: 'userId', select: 'name', model: User })
//       .sort({ time: 1 })
//       .lean();

//     // alias مثل القديم
//     const mapped = appointments.map((a) => ({
//       ...a,
//       patient: a.userId,
//       userId: a.userId?._id || a.userId,
//     }));
//     res.status(200).json(mapped);
//   } catch (err) {
//     res.status(500).json({
//       message: "Failed to fetch today's appointments",
//       error: err.message,
//     });
//   }
// };

// GET /api/appointments/check?date=YYYY-MM-DD&time=HH:mm
// export const checkAvailability = async (req, res) => {
//   const { date, time } = req.query;
//   if (!date || !time)
//     return res.status(400).json({ message: 'Date and time are required' });

//   try {
//     const d = new Date(date);
//     const day = new Date(
//       Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
//     );

//     const exists = await Appointment.exists({
//       date: day,
//       time,
//       status: { $ne: 'cancelled' },
//     });

//     res.status(200).json({ available: !exists });
//   } catch (err) {
//     res.status(500).json({ message: 'Error checking availability' });
//   }
// };
