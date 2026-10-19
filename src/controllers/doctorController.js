import User from '../../models/User.js';
import mongoose from 'mongoose';
import {
  CONFLICT_STATUSES,
  generateTimeSlots,
  getWeekdayName,
} from '../utils/fuctions.js';
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
import Service from '../../models/Service.js';
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
export const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayString}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const sessions = await TreatmentSession.find({
      doctorId,
      date: { $gte: today },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    })
      .populate({
        path: 'treatmentId',
        select: 'userId serviceGroupId serviceItemId totalSessions note status',
        populate: {
          path: 'userId',
          select: 'name birth gender',
        },
      })
      .sort({ date: 1, time: 1 })
      .lean();
    const previousSessions = await TreatmentSession.find({
      doctorId,
      date: { $lt: today },
      status: 'completed',
    })
      .populate({
        path: 'treatmentId',
        select: 'userId serviceGroupId serviceItemId totalSessions note status',
        populate: {
          path: 'userId',
          select: 'name birth gender',
        },
      })
      .sort({ date: -1, time: -1 })
      .lean();
    console.log(
      'PREVIOUS SESSIONS:',
      previousSessions.map((session) => ({
        sessionId: session._id,
        doctorId: session.doctorId,
        patientId: session.treatmentId?.userId?._id,
        treatmentId: session.treatmentId?._id,
        date: session.date,
        status: session.status,
      })),
    );
    const allSessions = [...sessions, ...previousSessions];
    const groupIds = [
      ...new Set(
        allSessions
          .map((session) => session.treatmentId?.serviceGroupId?.toString())
          .filter(Boolean),
      ),
    ];
    const groups = await Service.find({
      _id: { $in: groupIds },
    }).lean();
    const groupMap = new Map(groups.map((group) => [String(group._id), group]));
    const formatSession = (session) => {
      const treatment = session.treatmentId;
      if (!treatment?.userId) return null;
      const patient = treatment.userId;
      const group = groupMap.get(String(treatment.serviceGroupId));
      const service = group?.services?.find(
        (item) => String(item._id) === String(treatment.serviceItemId),
      );
      return {
        _id: session._id,
        treatmentId: treatment._id,
        patient: {
          _id: patient._id,
          name: patient.name,
          dateOfBirth: patient.birth || null,
          gender: patient.gender || null,
        },
        serviceName: service?.name || 'טיפול',
        durationMin: service?.durationMin || null,
        sessionNumber: session.sessionNumber,
        totalSessions: treatment.totalSessions,
        date: session.date,
        time: session.time,
        status: session.status,
        note: session.note || '',
      };
    };
    const formatted = sessions.map(formatSession).filter(Boolean);
    const formattedPrevious = previousSessions
      .map(formatSession)
      .filter(Boolean);
    const todaySessions = formatted.filter((session) => {
      const date = new Date(session.date);
      return date >= today && date < tomorrow;
    });
    const lastSessionMap = new Map();
    for (const session of formattedPrevious) {
      const patientId = String(session.patient._id);
      if (!lastSessionMap.has(patientId)) {
        lastSessionMap.set(patientId, session);
      }
    }
    const upcomingMap = new Map();
    for (const session of formatted) {
      if (!CONFLICT_STATUSES.includes(session.status)) {
        continue;
      }
      if (new Date(session.date) < tomorrow) {
        continue;
      }
      const patientId = String(session.patient._id);
      if (!upcomingMap.has(patientId)) {
        upcomingMap.set(patientId, session);
      }
    }
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const calculateDays = (date) => {
      if (!date) return null;
      const target = new Date(date);
      return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
    };
    const upcomingPatients = formatted
      .filter((session) => {
        if (!CONFLICT_STATUSES.includes(session.status)) {
          return false;
        }
        return new Date(session.date) >= tomorrow;
      })
      .map((nextSession) => {
        const patientId = String(nextSession.patient._id);
        const lastSession = lastSessionMap.get(patientId) || null;
        const daysUntilNext = calculateDays(nextSession.date);
        return {
          _id: nextSession._id,
          patient: nextSession.patient,
          serviceName: nextSession.serviceName,
          treatmentId: nextSession.treatmentId,
          lastSession: lastSession
            ? {
                _id: lastSession._id,
                date: lastSession.date,
                time: lastSession.time,
                serviceName: lastSession.serviceName,
              }
            : null,
          nextSession: {
            _id: nextSession._id,
            date: nextSession.date,
            time: nextSession.time,
            serviceName: nextSession.serviceName,
            status: nextSession.status,
          },
          daysUntilNext,
          daysSinceLast: lastSession ? -calculateDays(lastSession.date) : null,
        };
      })
      .sort((a, b) => {
        const dateDifference =
          new Date(a.nextSession.date) - new Date(b.nextSession.date);
        if (dateDifference !== 0) return dateDifference;
        return a.nextSession.time.localeCompare(b.nextSession.time);
      })
      .slice(0, 4);
    return res.status(200).json({
      success: true,
      todaySessions,
      todayCount: todaySessions.length,
      upcomingPatients,
    });
  } catch (error) {
    console.error('getDoctorDashboard:', error);
    return res.status(500).json({
      message: 'Failed to load doctor dashboard',
    });
  }
};
export const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const sessions = await TreatmentSession.find({ doctorId })
      .populate({
        path: 'treatmentId',
        select: 'userId serviceGroupId serviceItemId totalSessions status note',
        populate: {
          path: 'userId',
          select: 'name phoneNumber birth gender',
        },
      })
      .sort({ date: -1, time: -1 })
      .lean();
    const groupIds = [
      ...new Set(
        sessions
          .map((session) => session.treatmentId?.serviceGroupId?.toString())
          .filter(Boolean),
      ),
    ];
    const groups = groupIds.length
      ? await Service.find({ _id: { $in: groupIds } }).lean()
      : [];
    const groupMap = new Map(groups.map((group) => [String(group._id), group]));
    const appointments = sessions.map((session) => {
      const treatment = session.treatmentId;
      const patient = treatment?.userId;
      const group = treatment
        ? groupMap.get(String(treatment.serviceGroupId))
        : null;
      const service = group?.services?.find(
        (item) => String(item._id) === String(treatment?.serviceItemId),
      );
      return {
        _id: session._id,
        treatmentId: treatment?._id ?? null,
        treatmentStatus: treatment?.status ?? null,
        patient: patient
          ? {
              _id: patient._id,
              name: patient.name,
              phoneNumber: patient.phoneNumber,
              birth: patient.birth ?? null,
              gender: patient.gender ?? null,
            }
          : null,
        serviceName: service?.name ?? 'שירות לא זמין',
        durationMin: service?.durationMin ?? null,
        sessionNumber: session.sessionNumber,
        totalSessions: treatment?.totalSessions ?? null,
        date: session.date,
        time: session.time,
        status: session.status,
        note: session.note ?? '',
      };
    });
    const stats = {
      total: appointments.length,
      pending: appointments.filter((a) => a.status === 'pending').length,
      confirmed: appointments.filter((a) => a.status === 'confirmed').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
      rejected: appointments.filter((a) => a.status === 'rejected').length,
    };
    return res.status(200).json({
      success: true,
      appointments,
      stats,
    });
  } catch (error) {
    console.error('getDoctorAppointments:', error);
    return res.status(500).json({
      message: 'Failed to load doctor appointments',
    });
  }
};
