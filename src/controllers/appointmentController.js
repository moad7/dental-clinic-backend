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
import Service from '../../models/Service.js';
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
export const getPatientTreatmentPlans = async (req, res) => {
  try {
    const patientId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        message: 'Invalid patient id',
      });
    }
    const treatments = await Treatment.find({
      userId: patientId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();
    if (!treatments.length) {
      return res.status(200).json({
        success: true,
        treatments: [],
      });
    }
    /*
     * =========================
     * SERVICE GROUPS
     * =========================
     */
    const serviceGroupIds = [
      ...new Set(
        treatments
          .map((treatment) => treatment.serviceGroupId?.toString())
          .filter(Boolean),
      ),
    ];
    const serviceGroups = await Service.find({
      _id: {
        $in: serviceGroupIds,
      },
    }).lean();
    const serviceGroupMap = new Map(
      serviceGroups.map((group) => [String(group._id), group]),
    );
    /*
     * =========================
     * SESSIONS
     * =========================
     */
    const treatmentIds = treatments.map((treatment) => treatment._id);
    const sessions = await TreatmentSession.find({
      treatmentId: {
        $in: treatmentIds,
      },
    })
      .populate({
        path: 'doctorId',
        select: 'name avatar doctor',
      })
      .sort({
        date: 1,
        time: 1,
      })
      .lean();
    /*
     * group sessions by treatmentId
     */
    const sessionsMap = new Map();
    sessions.forEach((session) => {
      const key = String(session.treatmentId);
      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, []);
      }
      sessionsMap.get(key).push(session);
    });
    /*
     * =========================
     * FORMAT
     * =========================
     */
    const formattedTreatments = treatments.map((treatment) => {
      const treatmentSessions = sessionsMap.get(String(treatment._id)) || [];
      const serviceGroup = serviceGroupMap.get(
        String(treatment.serviceGroupId),
      );
      const serviceItem = serviceGroup?.services?.find(
        (item) => String(item._id) === String(treatment.serviceItemId),
      );
      /*
       * completed sessions
       */
      const completedSessions = treatmentSessions.filter(
        (session) => session.status === 'completed',
      ).length;
      const totalSessions = Number(treatment.totalSessions) || 1;
      const progress =
        totalSessions > 0
          ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
          : 0;
      /*
       * first session
       */
      const firstSession =
        treatmentSessions.length > 0 ? treatmentSessions[0] : null;
      /*
       * next session
       */
      const now = new Date();
      const nextSession =
        treatmentSessions.find((session) => {
          if (!['pending', 'confirmed'].includes(session.status)) {
            return false;
          }
          const dateOnly =
            session.date instanceof Date
              ? session.date.toISOString().slice(0, 10)
              : String(session.date).slice(0, 10);
          const sessionDateTime = new Date(`${dateOnly}T${session.time}:00`);
          return sessionDateTime >= now;
        }) || null;
      /*
       * latest doctor
       */
      const sessionWithDoctor =
        [...treatmentSessions].reverse().find((session) => session.doctorId) ||
        null;
      const doctor = sessionWithDoctor?.doctorId || null;
      /*
       * formatted sessions
       */
      const formattedSessions = treatmentSessions.map((session) => ({
        _id: session._id,
        sessionNumber: session.sessionNumber,
        date: session.date,
        time: session.time,
        status: session.status,
        note: session.note || '',
        doctor: session.doctorId
          ? {
              _id: session.doctorId._id,
              name: session.doctorId.name,
              avatar: session.doctorId.avatar || null,
            }
          : null,
        durationMin: serviceItem?.durationMin || null,
      }));
      /*
       * Expected end date:
       * for now use last scheduled session.
       */
      const lastSession =
        treatmentSessions.length > 0
          ? treatmentSessions[treatmentSessions.length - 1]
          : null;
      return {
        _id: treatment._id,
        status: treatment.status,
        note: treatment.note || '',
        createdAt: treatment.createdAt,
        serviceGroup: serviceGroup
          ? {
              _id: serviceGroup._id,
              title: serviceGroup.title,
            }
          : null,
        service: serviceItem
          ? {
              _id: serviceItem._id,
              name: serviceItem.name,
              description: serviceItem.description || '',
              durationMin: serviceItem.durationMin,
              price: serviceItem.price,
              photo: serviceItem.photo || null,
            }
          : null,
        doctor: doctor
          ? {
              _id: doctor._id,
              name: doctor.name,
              avatar: doctor.avatar || null,
            }
          : null,
        totalSessions,
        completedSessions,
        progress,
        startDate: firstSession?.date || treatment.createdAt,
        expectedEndDate: lastSession?.date || null,
        nextSession: nextSession
          ? {
              _id: nextSession._id,
              date: nextSession.date,
              time: nextSession.time,
              status: nextSession.status,
            }
          : null,
        sessions: formattedSessions,
      };
    });
    return res.status(200).json({
      success: true,
      treatments: formattedTreatments,
    });
  } catch (error) {
    console.error('getPatientTreatmentPlans error:', error);
    return res.status(500).json({
      message: 'Failed to get patient treatment plans',
      error: error.message,
    });
  }
};
