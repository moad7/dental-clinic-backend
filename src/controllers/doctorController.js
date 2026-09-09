import User from '../../models/User.js';
import mongoose from 'mongoose';
import { generateTimeSlots, getWeekdayName } from '../utils/fuctions.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import {
  getDateOnlyRange,
  timeToMinutes,
} from '../helpers/appointmentHelpers.js';
import {
  getDoctorBookedPeriods,
  getServiceItem,
  hasDoctorTimeConflict,
} from '../utils/appointmentAvailability.js';
// GET /api/doctor/getAllDoctors
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-password -tokens -activationToken')
      .populate({
        path: 'doctor.services.groupId',
        select: 'title services',
      })
      .sort({ createdAt: -1 });
    return res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error('getAllDoctors error:', error);
    return res.status(500).json({
      message: 'Failed to fetch doctors',
      error: error.message,
    });
  }
};
// POST /api/doctor/getDoctorsByService
export const getDoctorsByService = async (req, res) => {
  try {
    const { payload } = req.body;
    const { serviceGroupId } = payload || {};
    if (!serviceGroupId) {
      return res.status(400).json({
        message: 'serviceGroupId is required',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(serviceGroupId)) {
      return res.status(400).json({
        message: 'Invalid serviceGroupId',
      });
    }
    const serviceObjectId = new mongoose.Types.ObjectId(serviceGroupId);
    const doctors = await User.find({
      role: 'doctor',
      isActive: true,
      doctor: { $exists: true },
      'doctor.services.groupId': serviceObjectId,
    })
      .select('-password -tokens -activationToken -activationTokenExpires')
      .populate({
        path: 'doctor.services.groupId',
        select: 'title services',
      })
      .populate({
        path: 'doctor.clinic',
        select: 'name address phones',
      })
      .lean();
    return res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error('getDoctorsByService error:', error);
    return res.status(500).json({
      message: 'Failed to get doctors by service',
      error: error.message,
    });
  }
};
// POST /api/secretary/doctor-available-slots
// export const getDoctorAvailableSlots = async (req, res) => {
//   try {
//     const { payload } = req.body;
//     const { doctorId, date } = payload || {};
//     if (!doctorId || !date) {
//       return res.status(400).json({
//         message: 'doctorId and date are required',
//       });
//     }
//     if (!mongoose.Types.ObjectId.isValid(doctorId)) {
//       return res.status(400).json({
//         message: 'Invalid doctorId',
//       });
//     }
//     const weekday = getWeekdayName(date);
//     const dateRange = getDateOnlyRange(date);
//     if (!weekday || !dateRange) {
//       return res.status(400).json({
//         message: 'Invalid date',
//       });
//     }
//     const doctor = await User.findOne({
//       _id: doctorId,
//       role: 'doctor',
//       isActive: true,
//       doctor: { $exists: true },
//     })
//       .select('-password -tokens -activationToken -activationTokenExpires')
//       .lean();
//     if (!doctor) {
//       return res.status(404).json({
//         message: 'Doctor not found',
//       });
//     }
//     const workDay = doctor.doctor?.workingHours?.find(
//       (day) => day.day === weekday && !day.isClosed,
//     );
//     if (!workDay) {
//       return res.status(200).json({
//         doctorId,
//         date,
//         slots: [],
//       });
//     }
//     const allSlots = generateTimeSlots(workDay.start, workDay.end, 30);
//     const bookedSessions = await TreatmentSession.find({
//       doctorId,
//       status: { $in: CONFLICT_STATUSES },
//       date: {
//         $gte: dateRange.start,
//         $lt: dateRange.end,
//       },
//     })
//       .select('time')
//       .lean();
//     const bookedTimes = new Set(bookedSessions.map((s) => s.time));
//     const availableSlots = allSlots.filter((slot) => !bookedTimes.has(slot));
//     return res.status(200).json({
//       doctorId,
//       date,
//       workingHours: {
//         start: workDay.start,
//         end: workDay.end,
//       },
//       slots: availableSlots,
//     });
//   } catch (error) {
//     console.error('getDoctorAvailableSlots error:', error);
//     return res.status(500).json({
//       message: 'Failed to get doctor available slots',
//       error: error.message,
//     });
//   }
// };
export const getDoctorAvailableSlots = async (req, res) => {
  try {
    const { payload } = req.body;
    const { doctorId, date, serviceGroupId, serviceItemId } = payload || {};
    /* =========================
       REQUIRED
    ========================= */
    if (!doctorId || !date || !serviceGroupId || !serviceItemId) {
      return res.status(400).json({
        message:
          'doctorId, date, serviceGroupId and serviceItemId are required',
      });
    }
    /* =========================
       IDS
    ========================= */
    const ids = [doctorId, serviceGroupId, serviceItemId];
    const invalidId = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
      return res.status(400).json({
        message: 'Invalid ObjectId',
        invalidId,
      });
    }
    /* =========================
       DATE
    ========================= */
    const weekday = getWeekdayName(date);
    const dateRange = getDateOnlyRange(date);
    if (!weekday || !dateRange) {
      return res.status(400).json({
        message: 'Invalid date',
      });
    }
    /* =========================
       SERVICE
    ========================= */
    const { serviceGroup, serviceItem } = await getServiceItem(
      serviceGroupId,
      serviceItemId,
    );
    if (!serviceGroup) {
      return res.status(404).json({
        message: 'Service group not found',
      });
    }
    if (!serviceItem) {
      return res.status(404).json({
        message: 'Service item not found in selected service group',
      });
    }
    const durationMin = Number(serviceItem.durationMin);
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      return res.status(400).json({
        message: 'Invalid service duration',
      });
    }
    /* =========================
       DOCTOR
    ========================= */
    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isActive: true,
      'doctor.services.groupId': serviceGroupId,
    })
      .select('-password -tokens -activationToken -activationTokenExpires')
      .lean();
    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found or does not provide this service',
      });
    }
    /* =========================
       WORK DAY
    ========================= */
    const workDay = doctor.doctor?.workingHours?.find(
      (day) => day.day === weekday && !day.isClosed,
    );
    if (!workDay) {
      return res.status(200).json({
        doctorId,
        date,
        workingHours: null,
        slots: [],
      });
    }
    /* =========================
       BOOKED PERIODS
    ========================= */
    const bookedPeriods = await getDoctorBookedPeriods({
      doctorId,
      dateRange,
    });
    /* =========================
       GENERATE CANDIDATE SLOTS
    ========================= */
    const allSlots = generateTimeSlots(workDay.start, workDay.end, 30);
    const workEnd = timeToMinutes(workDay.end);
    /* =========================
       AVAILABLE SLOTS
    ========================= */
    const availableSlots = allSlots.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      if (slotStart === null) {
        return false;
      }
      const slotEnd = slotStart + durationMin;
      if (slotEnd > workEnd) {
        return false;
      }
      return !hasDoctorTimeConflict({
        startTime: slot,
        durationMin,
        bookedPeriods,
      });
    });
    /* =========================
       RESPONSE
    ========================= */
    return res.status(200).json({
      doctorId,
      date,
      service: {
        serviceGroupId,
        serviceItemId,
        name: serviceItem.name,
        durationMin,
      },
      workingHours: {
        start: workDay.start,
        end: workDay.end,
      },
      slots: availableSlots,
    });
  } catch (error) {
    console.error('getDoctorAvailableSlots error:', error);
    return res.status(500).json({
      message: 'Failed to get doctor available slots',
      error: error.message,
    });
  }
};
