import mongoose from 'mongoose';
import User from '../../models/User.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import Treatment from '../../models/Treatment.js';
import {
  AppointmentError,
  validateSessionStatus,
  validateTreatmentStatus,
  getTreatmentStatusFromSingleSession,
  calculateTreatmentStatusFromSessions,
  validateDoctorForTreatment,
  checkDoctorAvailability,
  validateRequestedTreatmentStatus,
  isValidDateOnly,
  isRangeTooLarge,
  PATIENT_CALENDAR_SESSION_STATUSES,
  normalizePatientCalendarSession,
  getCurrentDateAndTime,
  compareSessionDateTime,
  getCalendarHours,
  parseDateOnlyUTC,
  getDateOnlyRange,
  isValidTime,
} from '../helpers/appointmentHelpers.js';
import {
  getDoctorBookedPeriods,
  getServiceItem,
  hasDoctorTimeConflict,
  timeToMinutes,
  CONFLICT_STATUSES,
} from '../utils/appointmentAvailability.js';
import { getWeekdayName } from '../utils/fuctions.js';
// export const createAppointment = async (req, res) => {
//   try {
//     const payload = req.body;
//     const {
//       patientId: bodyPatientId,
//       doctorId,
//       serviceGroupId,
//       serviceItemId,
//       requiresMultipleSessions,
//       totalSessions,
//       session,
//       note,
//     } = payload || {};
//     const createdByRole = req.user.role;
//     const createdBy = req.user.userId;
//     const patientId =
//       createdByRole === 'secretary' ? bodyPatientId : req.user.userId;
//     if (
//       !patientId ||
//       !doctorId ||
//       !serviceGroupId ||
//       !serviceItemId ||
//       !session?.date ||
//       !session?.time
//     ) {
//       return res.status(400).json({
//         message: 'Missing required fields',
//       });
//     }
//     if (!isValidTime(session.time)) {
//       return res.status(400).json({
//         message: 'Invalid time format. Expected HH:mm',
//       });
//     }
//     const appointmentDate = parseDateOnlyUTC(session.date);
//     if (!appointmentDate) {
//       return res.status(400).json({
//         message: 'Invalid session date. Expected YYYY-MM-DD',
//       });
//     }
//     const ids = [patientId, doctorId, createdBy, serviceGroupId, serviceItemId];
//     const invalidId = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
//     if (invalidId) {
//       return res.status(400).json({
//         message: 'Invalid ObjectId',
//         invalidId,
//       });
//     }
//     const patient = await User.findOne({
//       _id: patientId,
//       role: 'patient',
//     });
//     if (!patient) {
//       return res.status(404).json({
//         message: 'Patient not found',
//       });
//     }
//     if (!patient.isActive) {
//       return res.status(404).json({
//         message: `The patient is inactive`,
//       });
//     }
//     const doctor = await User.findOne({
//       _id: doctorId,
//       role: 'doctor',
//       isActive: true,
//       'doctor.services.groupId': serviceGroupId,
//     });
//     if (!doctor) {
//       return res.status(404).json({
//         message: 'Doctor not found or does not provide this service',
//       });
//     }
//     const serviceGroup = await Service.findById(serviceGroupId).lean();
//     if (!serviceGroup) {
//       return res.status(404).json({
//         message: 'Service group not found',
//       });
//     }
//     const serviceItem = serviceGroup.services?.find(
//       (item) => String(item._id) === String(serviceItemId),
//     );
//     if (!serviceItem) {
//       return res.status(404).json({
//         message: 'Service item not found in selected service group',
//       });
//     }
//     const durationMin = Number(serviceItem.durationMin);
//     if (!durationMin || durationMin <= 0) {
//       return res.status(400).json({
//         message: 'Invalid service duration',
//       });
//     }
//     const dateRange = {
//       start: appointmentDate,
//       end: new Date(appointmentDate),
//     };
//     dateRange.end.setUTCDate(dateRange.end.getUTCDate() + 1);
//     const doctorConflict = await TreatmentSession.exists({
//       doctorId,
//       status: { $in: ['pending', 'confirmed'] },
//       date: {
//         $gte: dateRange.start,
//         $lt: dateRange.end,
//       },
//     })
//       .populate({
//         path: 'treatmentId',
//         select: 'serviceGroupId serviceItemId',
//       })
//       .lean();
//     if (doctorConflict) {
//       return res.status(409).json({
//         message: 'Doctor already has an appointment at this date and time',
//       });
//     }
//     const patientTreatments = await Treatment.find({
//       userId: patientId,
//       status: { $ne: 'completed' },
//     }).select('_id');
//     const treatmentIds = patientTreatments.map((t) => t._id);
//     if (treatmentIds.length > 0) {
//       const patientSameDaySession = await TreatmentSession.exists({
//         treatmentId: { $in: treatmentIds },
//         status: { $ne: 'completed' },
//         date: {
//           $gte: dateRange.start,
//           $lt: dateRange.end,
//         },
//       });
//       if (patientSameDaySession) {
//         return res.status(409).json({
//           message:
//             'Patient already has an appointment on this day. Complete the existing appointment first.',
//         });
//       }
//     }
//     const isMultipleSessions =
//       requiresMultipleSessions === true || requiresMultipleSessions === 'true';
//     const sessionsCount = isMultipleSessions ? Number(totalSessions) : 1;
//     if (!Number.isInteger(sessionsCount) || sessionsCount < 1) {
//       return res.status(400).json({
//         message: 'totalSessions must be an integer greater than or equal to 1',
//       });
//     }
//     const treatment = await Treatment.create({
//       userId: patientId,
//       serviceGroupId,
//       serviceItemId,
//       totalSessions: sessionsCount,
//       note,
//       createdBy,
//       createdByRole,
//     });
//     const sessionStatus =
//       createdByRole === 'secretary' && session?.status
//         ? session.status
//         : 'pending';
//     const treatmentSession = await TreatmentSession.create({
//       treatmentId: treatment._id,
//       sessionNumber: 1,
//       doctorId,
//       date: appointmentDate,
//       time: session.time,
//       status: sessionStatus,
//       note: session.note,
//       createdBy,
//       createdByRole,
//     });
//     return res.status(201).json({
//       message: 'Appointment created successfully',
//       treatment,
//       session: treatmentSession,
//     });
//   } catch (error) {
//     console.error('createAppointment error:', error);
//     return res.status(500).json({
//       message: 'Failed to create appointment',
//       error: error.message,
//     });
//   }
// };
// GET /api/appointments/
export const createAppointment = async (req, res) => {
  try {
    const {
      patientId: bodyPatientId,
      doctorId,
      serviceGroupId,
      serviceItemId,
      requiresMultipleSessions,
      totalSessions,
      session,
      note,
    } = req.body || {};
    const createdByRole = req.user.role;
    const createdBy = req.user.userId;
    const patientId =
      createdByRole === 'secretary' ? bodyPatientId : req.user.userId;
    /* =========================
       REQUIRED FIELDS
    ========================= */
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
    /* =========================
       TIME
    ========================= */
    if (!isValidTime(session.time)) {
      return res.status(400).json({
        message: 'Invalid time format. Expected HH:mm',
      });
    }
    /* =========================
       DATE
    ========================= */
    const appointmentDate = parseDateOnlyUTC(session.date);
    if (!appointmentDate) {
      return res.status(400).json({
        message: 'Invalid session date. Expected YYYY-MM-DD',
      });
    }
    /* =========================
       IDS
    ========================= */
    const ids = [patientId, doctorId, createdBy, serviceGroupId, serviceItemId];
    const invalidId = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
      return res.status(400).json({
        message: 'Invalid ObjectId',
        invalidId,
      });
    }
    /* =========================
       PATIENT
    ========================= */
    const patient = await User.findOne({
      _id: patientId,
      role: 'patient',
    });
    if (!patient) {
      return res.status(404).json({
        message: 'Patient not found',
      });
    }
    if (!patient.isActive) {
      return res.status(400).json({
        message: 'The patient is inactive',
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
    }).lean();
    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found or does not provide this service',
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
       DATE RANGE
    ========================= */
    const dateRange = {
      start: appointmentDate,
      end: new Date(appointmentDate),
    };
    dateRange.end.setUTCDate(dateRange.end.getUTCDate() + 1);
    /* =========================
       WORKING HOURS
    ========================= */
    const weekday = getWeekdayName(session.date);
    if (!weekday) {
      return res.status(400).json({
        message: 'Invalid weekday',
      });
    }
    const workDay = doctor.doctor?.workingHours?.find(
      (day) => day.day === weekday && !day.isClosed,
    );
    if (!workDay) {
      return res.status(409).json({
        message: 'Doctor is not working on the selected day',
      });
    }
    const appointmentStart = timeToMinutes(session.time);
    const appointmentEnd = appointmentStart + durationMin;
    const workStart = timeToMinutes(workDay.start);
    const workEnd = timeToMinutes(workDay.end);
    if (appointmentStart < workStart || appointmentEnd > workEnd) {
      return res.status(409).json({
        message: 'Selected time is outside doctor working hours',
      });
    }
    /* =========================
       DOCTOR CONFLICT
    ========================= */
    const bookedPeriods = await getDoctorBookedPeriods({
      doctorId,
      dateRange,
    });
    const doctorConflict = hasDoctorTimeConflict({
      startTime: session.time,
      durationMin,
      bookedPeriods,
    });
    if (doctorConflict) {
      return res.status(409).json({
        message:
          'Doctor already has an overlapping appointment at this date and time',
      });
    }
    /* =========================
       PATIENT SAME DAY
    ========================= */
    const patientTreatments = await Treatment.find({
      userId: patientId,
      status: 'in_progress',
    }).select('_id');
    const treatmentIds = patientTreatments.map((treatment) => treatment._id);
    if (treatmentIds.length) {
      const patientConflict = await TreatmentSession.exists({
        treatmentId: {
          $in: treatmentIds,
        },
        status: {
          $in: CONFLICT_STATUSES,
        },
        date: {
          $gte: dateRange.start,
          $lt: dateRange.end,
        },
      });
      if (patientConflict) {
        return res.status(409).json({
          message:
            'Patient already has an appointment on this day. Complete the existing appointment first.',
        });
      }
    }
    /* =========================
       TOTAL SESSIONS
    ========================= */
    const isMultipleSessions =
      requiresMultipleSessions === true || requiresMultipleSessions === 'true';
    const sessionsCount = isMultipleSessions ? Number(totalSessions) : 1;
    if (!Number.isInteger(sessionsCount) || sessionsCount < 1) {
      return res.status(400).json({
        message: 'totalSessions must be an integer greater than or equal to 1',
      });
    }
    /* =========================
       CREATE TREATMENT
    ========================= */
    const treatment = await Treatment.create({
      userId: patientId,
      serviceGroupId,
      serviceItemId,
      totalSessions: sessionsCount,
      note,
      createdBy,
      createdByRole,
    });
    /* =========================
       STATUS
    ========================= */
    const allowedSecretaryStatuses = ['pending', 'confirmed'];
    const sessionStatus =
      createdByRole === 'secretary' &&
      allowedSecretaryStatuses.includes(session?.status)
        ? session.status
        : 'pending';
    /* =========================
       CREATE SESSION
    ========================= */
    const treatmentSession = await TreatmentSession.create({
      treatmentId: treatment._id,
      sessionNumber: 1,
      doctorId,
      date: appointmentDate,
      time: session.time,
      status: sessionStatus,
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
          (service) => String(service._id) === String(treatment?.serviceItemId),
        ) || null;
      const normalizedGroup = group
        ? {
            _id: group._id,
            title: group.title,
          }
        : null;
      return {
        ...appt,
        treatmentId: treatment
          ? {
              ...treatment,
              serviceGroupId: normalizedGroup,
              serviceItem,
            }
          : null,
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
export const updateAppointment = async (req, res) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { appointmentId } = req.params;
    const { doctorId, date, time, sessionStatus, treatmentStatus, note } =
      req.body;
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment id',
      });
    }
    validateSessionStatus(sessionStatus);
    validateTreatmentStatus(treatmentStatus);
    let updatedSession = null;
    let updatedTreatment = null;
    await mongoSession.withTransaction(async () => {
      const appointment =
        await TreatmentSession.findById(appointmentId).session(mongoSession);
      if (!appointment) {
        throw new AppointmentError('Appointment not found', 404);
      }
      const treatment = await Treatment.findById(
        appointment.treatmentId,
      ).session(mongoSession);
      if (!treatment) {
        throw new AppointmentError('Treatment not found', 404);
      }
      const requiresSchedule =
        sessionStatus === 'pending' || sessionStatus === 'confirmed';
      let dateRange = null;
      if (requiresSchedule) {
        if (!doctorId || !date || !time) {
          throw new AppointmentError(
            'Doctor, date and time are required for pending or confirmed sessions',
            400,
          );
        }
        if (!isValidTime(time)) {
          throw new AppointmentError(
            'Invalid time format. Expected HH:mm',
            400,
          );
        }
        dateRange = getDateOnlyRange(date);
        if (!dateRange) {
          throw new AppointmentError('Invalid appointment date', 400);
        }
        await validateDoctorForTreatment({
          doctorId,
          treatment,
          date,
          time,
          mongoSession,
          requireActive: true,
          checkWorkingHours: true,
        });
        await checkDoctorAvailability({
          doctorId,
          dateRange,
          time,
          sessionId: appointment._id,
          mongoSession,
        });
      }
      if (
        !requiresSchedule &&
        doctorId &&
        String(doctorId) !== String(appointment.doctorId)
      ) {
        await validateDoctorForTreatment({
          doctorId,
          treatment,
          date: date || null,
          time: time || null,
          mongoSession,
          requireActive: false,
          checkWorkingHours: false,
        });
      }
      /* ------------------------------------------
         Validate optional date/time
      -------------------------------------------*/
      let optionalDateRange = null;
      if (!requiresSchedule && date) {
        optionalDateRange = getDateOnlyRange(date);
        if (!optionalDateRange) {
          throw new AppointmentError('Invalid appointment date', 400);
        }
      }
      if (!requiresSchedule && time) {
        if (!isValidTime(time)) {
          throw new AppointmentError(
            'Invalid time format. Expected HH:mm',
            400,
          );
        }
      }
      appointment.status = sessionStatus;
      if (typeof note === 'string') {
        appointment.note = note.trim();
      }
      if (doctorId) {
        appointment.doctorId = doctorId;
      }
      if (requiresSchedule && dateRange) {
        appointment.date = dateRange.start;
      } else if (optionalDateRange) {
        appointment.date = optionalDateRange.start;
      }
      if (time) {
        appointment.time = time;
      }
      await appointment.save({
        session: mongoSession,
      });
      let calculatedTreatmentStatus;
      if (treatment.totalSessions === 1) {
        calculatedTreatmentStatus =
          getTreatmentStatusFromSingleSession(sessionStatus);
      } else {
        const allSessions = await TreatmentSession.find({
          treatmentId: treatment._id,
        })
          .select('_id status')
          .session(mongoSession)
          .lean();
        calculatedTreatmentStatus = calculateTreatmentStatusFromSessions({
          sessions: allSessions,
          totalSessions: treatment.totalSessions,
        });
      }
      validateRequestedTreatmentStatus({
        requestedStatus: treatmentStatus,
        calculatedStatus: calculatedTreatmentStatus,
      });
      const oldTreatmentStatus = treatment.status;
      treatment.status = calculatedTreatmentStatus;
      if (calculatedTreatmentStatus === 'completed') {
        if (oldTreatmentStatus !== 'completed' || !treatment.completedAt) {
          treatment.completedAt = new Date();
        }
      } else {
        treatment.completedAt = null;
      }
      await treatment.save({
        session: mongoSession,
      });
      updatedSession = appointment.toObject();
      updatedTreatment = treatment.toObject();
    });
    return res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      session: updatedSession,
      treatment: updatedTreatment,
    });
  } catch (error) {
    console.error('updateAppointment error:', error);
    if (error instanceof AppointmentError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message,
    });
  } finally {
    await mongoSession.endSession();
  }
};
const calculateTreatmentStatus = ({ sessions, totalSessions }) => {
  if (totalSessions === 1) {
    const status = sessions[0]?.status;
    switch (status) {
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      case 'rejected':
        return 'rejected';
      case 'pending':
      case 'confirmed':
      default:
        return 'in_progress';
    }
  }
  if (!sessions.length) {
    return 'in_progress';
  }
  const statuses = sessions.map((session) => session.status);
  const hasAllSessions = sessions.length >= totalSessions;
  if (hasAllSessions && statuses.every((status) => status === 'completed')) {
    return 'completed';
  }
  if (hasAllSessions && statuses.every((status) => status === 'cancelled')) {
    return 'cancelled';
  }
  if (hasAllSessions && statuses.every((status) => status === 'rejected')) {
    return 'rejected';
  }
  return 'in_progress';
};
export const secretaryAppointmentDecision = async (req, res) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { appointmentId } = req.params;
    const { decision } = req.body;
    /* ------------------------------------------
       Validate appointment id
    -------------------------------------------*/
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment id',
      });
    }
    /* ------------------------------------------
       Validate decision
    -------------------------------------------*/
    const allowedDecisions = ['approve', 'reject'];
    if (!decision || !allowedDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be approve or reject',
      });
    }
    let updatedSession;
    let updatedTreatment;
    await mongoSession.withTransaction(async () => {
      /* --------------------------------------
           Find TreatmentSession
        ---------------------------------------*/
      const appointment =
        await TreatmentSession.findById(appointmentId).session(mongoSession);
      if (!appointment) {
        const error = new Error('Appointment not found');
        error.statusCode = 404;
        throw error;
      }
      /* --------------------------------------
           Only pending can be approved/rejected
        ---------------------------------------*/
      if (appointment.status !== 'pending') {
        const error = new Error(
          `Appointment cannot be processed because its current status is "${appointment.status}"`,
        );
        error.statusCode = 400;
        throw error;
      }
      /* --------------------------------------
           Find Treatment
        ---------------------------------------*/
      const treatment = await Treatment.findById(
        appointment.treatmentId,
      ).session(mongoSession);
      if (!treatment) {
        const error = new Error('Treatment not found');
        error.statusCode = 404;
        throw error;
      }
      /* ======================================
           APPROVE
        =======================================*/
      if (decision === 'approve') {
        appointment.status = 'confirmed';
        const doctor = await User.findOne({
          _id: appointment.doctorId,
          role: 'doctor',
          isActive: true,
          'doctor.services.groupId': treatment.serviceGroupId,
        })
          .select('_id')
          .session(mongoSession);
        if (!doctor) {
          const error = new Error(
            'Doctor is unavailable or does not provide this treatment service',
          );
          error.statusCode = 400;
          throw error;
        }
        const conflict = await TreatmentSession.findOne({
          _id: {
            $ne: appointment._id,
          },
          doctorId: appointment.doctorId,
          date: appointment.date,
          time: appointment.time,
          status: {
            $in: ['pending', 'confirmed'],
          },
        })
          .select('_id')
          .session(mongoSession);
        if (conflict) {
          const error = new Error(
            'Doctor already has another appointment at this date and time',
          );
          error.statusCode = 409;
          throw error;
        }
      }
      /* ======================================
           REJECT
        =======================================*/
      if (decision === 'reject') {
        appointment.status = 'rejected';
      }
      await appointment.save({
        session: mongoSession,
      });
      /* --------------------------------------
           Recalculate Treatment.status
        ---------------------------------------*/
      const allSessions = await TreatmentSession.find({
        treatmentId: treatment._id,
      })
        .select('_id status')
        .session(mongoSession)
        .lean();
      const treatmentStatus = calculateTreatmentStatus({
        sessions: allSessions,
        totalSessions: treatment.totalSessions,
      });
      treatment.status = treatmentStatus;
      if (treatmentStatus === 'completed') {
        if (!treatment.completedAt) {
          treatment.completedAt = new Date();
        }
      } else {
        treatment.completedAt = null;
      }
      await treatment.save({
        session: mongoSession,
      });
    });
    return res.status(200).json({
      success: true,
      message:
        decision === 'approve'
          ? 'Appointment approved successfully'
          : 'Appointment rejected successfully',
    });
  } catch (error) {
    console.error('secretaryAppointmentDecision error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to process appointment',
    });
  } finally {
    await mongoSession.endSession();
  }
};
export const getTodayAppointments = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const sessions = await TreatmentSession.find({
      date: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
      /////
      status: {
        $in: ['pending', 'confirmed', 'completed'],
      },
    })
      .populate({
        path: 'doctorId',
        select: 'name',
      })
      .populate({
        path: 'treatmentId',
        select: 'userId serviceGroupId serviceItemId status totalSessions',
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
      .sort({
        time: 1,
      })
      .lean();
    const appointments = sessions.map((session) => {
      const treatment = session.treatmentId;
      const patient = treatment?.userId;
      const doctor = session.doctorId;
      const serviceGroup = treatment?.serviceGroupId;
      const serviceItem =
        serviceGroup?.services?.find(
          (service) => String(service._id) === String(treatment?.serviceItemId),
        ) || null;
      return {
        _id: session._id,
        time: session.time,
        patient: {
          _id: patient?._id || null,
          name: patient?.name || '-',
          phoneNumber: patient?.phoneNumber || '',
        },
        doctor: {
          _id: doctor?._id || null,
          name: doctor?.name || '-',
        },
        service: {
          groupId: serviceGroup?._id || null,
          groupTitle: serviceGroup?.title || '-',
          itemId: treatment?.serviceItemId || null,
          name: serviceItem?.name || '-',
        },
        sessionStatus: session.status,
        treatmentStatus: treatment?.status || null,
        date: session.date,
      };
    });
    return res.status(200).json({
      success: true,
      date: startOfToday,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error('getTodayAppointments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today appointments',
      error: error.message,
    });
  }
};
// GET /api/appointments/patient/calendar
export const getPatientAppointmentsCalendar = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { from, to, status, doctorId, serviceGroupId } = req.query;
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticated user',
      });
    }
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'from and to are required',
      });
    }
    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD',
      });
    }
    if (from > to) {
      return res.status(400).json({
        success: false,
        message: 'from date must be before or equal to to date',
      });
    }
    if (isRangeTooLarge(from, to)) {
      return res.status(400).json({
        success: false,
        message: 'Calendar range cannot exceed 6 months',
      });
    }
    const fromRange = getDateOnlyRange(from);
    const toRange = getDateOnlyRange(to);
    if (!fromRange || !toRange) {
      return res.status(400).json({
        success: false,
        message: 'Invalid calendar date range',
      });
    }
    if (status && !PATIENT_CALENDAR_SESSION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session status',
      });
    }
    if (doctorId && !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctorId',
      });
    }
    if (serviceGroupId && !mongoose.Types.ObjectId.isValid(serviceGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serviceGroupId',
      });
    }
    const treatmentFilter = {
      userId: patientId,
    };
    if (serviceGroupId) {
      treatmentFilter.serviceGroupId = serviceGroupId;
    }
    const treatments = await Treatment.find(treatmentFilter)
      .select('_id userId serviceGroupId serviceItemId status note')
      .lean();
    const treatmentIds = treatments.map((treatment) => treatment._id);
    if (!treatmentIds.length) {
      return res.status(200).json({
        success: true,
        range: {
          from,
          to,
        },
        calendar: {
          earliestTime: '08:00',
          latestTime: '16:00',
        },
        appointments: [],
        upcomingAppointments: [],
        previousAppointments: [],
      });
    }
    const sessionBaseFilter = {
      treatmentId: {
        $in: treatmentIds,
      },
    };
    if (status) {
      sessionBaseFilter.status = status;
    }
    if (doctorId) {
      sessionBaseFilter.doctorId = doctorId;
    }
    const calendarFilter = {
      ...sessionBaseFilter,
      date: {
        $gte: fromRange.start,
        $lt: toRange.end,
      },
    };
    const calendarSessions = await TreatmentSession.find(calendarFilter)
      .populate({
        path: 'doctorId',
        select: 'name avatar doctor.workingHours doctor.clinic',
        populate: {
          path: 'doctor.clinic',
          select: 'name address',
        },
      })
      .populate({
        path: 'treatmentId',
        select: 'serviceGroupId serviceItemId status note',
        populate: {
          path: 'serviceGroupId',
          select: 'title services',
        },
      })
      .sort({
        date: 1,
        time: 1,
      })
      .lean();
    const previewSessions = await TreatmentSession.find(sessionBaseFilter)
      .populate({
        path: 'doctorId',
        select: 'name avatar doctor.workingHours doctor.clinic',
        populate: {
          path: 'doctor.clinic',
          select: 'name address',
        },
      })
      .populate({
        path: 'treatmentId',
        select: 'serviceGroupId serviceItemId status note',
        populate: {
          path: 'serviceGroupId',
          select: 'title services',
        },
      })
      .sort({
        date: 1,
        time: 1,
      })
      .lean();
    const normalizedCalendar = calendarSessions.map(
      normalizePatientCalendarSession,
    );
    const normalizedPreview = previewSessions.map(
      normalizePatientCalendarSession,
    );
    const { date: nowDate, time: nowTime } = getCurrentDateAndTime();
    const previousAppointments = normalizedPreview
      .filter((appointment) => {
        return compareSessionDateTime(appointment, nowDate, nowTime) < 0;
      })
      .sort((a, b) => {
        const aValue = `${a.date} ${a.startTime}`;
        const bValue = `${b.date} ${b.startTime}`;
        return bValue.localeCompare(aValue);
      })
      .slice(0, 5);
    const upcomingAppointments = normalizedPreview
      .filter((appointment) => {
        if (!['pending', 'confirmed'].includes(appointment.sessionStatus)) {
          return false;
        }
        return compareSessionDateTime(appointment, nowDate, nowTime) >= 0;
      })
      .sort((a, b) => {
        const aValue = `${a.date} ${a.startTime}`;
        const bValue = `${b.date} ${b.startTime}`;
        return aValue.localeCompare(bValue);
      })
      .slice(0, 5);
    const calendar = getCalendarHours(normalizedCalendar);
    const removeInternalFields = (appointment) => {
      const { _doctorWorkingHours, ...publicAppointment } = appointment;
      return publicAppointment;
    };
    return res.status(200).json({
      success: true,
      range: {
        from,
        to,
      },
      calendar,
      appointments: normalizedCalendar.map(removeInternalFields),
      upcomingAppointments: upcomingAppointments.map(removeInternalFields),
      previousAppointments: previousAppointments.map(removeInternalFields),
    });
  } catch (error) {
    console.error('getPatientAppointmentsCalendar error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch patient appointments calendar',
      error: error.message,
    });
  }
};
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
