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
import {
  AppointmentError,
  validateSessionStatus,
  validateTreatmentStatus,
  getTreatmentStatusFromSingleSession,
  calculateTreatmentStatusFromSessions,
  validateDoctorForTreatment,
  checkDoctorAvailability,
  validateRequestedTreatmentStatus,
} from '../helpers/appointmentHelpers.js';

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
    if (!patient.isActive) {
      return res.status(404).json({
        message: `The patient is inactive`,
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
      createdBy,
      createdByRole,
    });

    const treatmentSession = await TreatmentSession.create({
      treatmentId: treatment._id,
      doctorId,
      date: new Date(session.date),
      time: session.time,
      status: session.status,
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

    /* ----------------------------------------------
       1. Validate ID
    ------------------------------------------------*/
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment id',
      });
    }

    /* ----------------------------------------------
       2. Validate statuses before transaction
    ------------------------------------------------*/
    validateSessionStatus(sessionStatus);
    validateTreatmentStatus(treatmentStatus);

    /*
      Response values.
      سيتم تعبئتها داخل transaction.
    */
    let updatedSession = null;
    let updatedTreatment = null;

    /* ----------------------------------------------
       3. Start Transaction
    ------------------------------------------------*/
    await mongoSession.withTransaction(async () => {
      /* ------------------------------------------
         Get TreatmentSession
      -------------------------------------------*/
      const appointment =
        await TreatmentSession.findById(appointmentId).session(mongoSession);

      if (!appointment) {
        throw new AppointmentError('Appointment not found', 404);
      }

      /* ------------------------------------------
         Get Treatment
      -------------------------------------------*/
      const treatment = await Treatment.findById(
        appointment.treatmentId,
      ).session(mongoSession);

      if (!treatment) {
        throw new AppointmentError('Treatment not found', 404);
      }

      /* ------------------------------------------
         4. pending / confirmed require schedule
      -------------------------------------------*/
      const requiresSchedule =
        sessionStatus === 'pending' || sessionStatus === 'confirmed';

      let dateRange = null;

      if (requiresSchedule) {
        /*
          المستخدم يجب أن يرسل الثلاثة بوضوح
          عند pending / confirmed.
        */
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

        /* ----------------------------------------
           Doctor:
           - active
           - same service
           - working this day
           - time inside working hours
        -----------------------------------------*/
        await validateDoctorForTreatment({
          doctorId,
          treatment,
          date,
          time,
          mongoSession,
          requireActive: true,
          checkWorkingHours: true,
        });

        /* ----------------------------------------
           Conflict check
        -----------------------------------------*/
        await checkDoctorAvailability({
          doctorId,
          dateRange,
          time,
          sessionId: appointment._id,
          mongoSession,
        });
      }

      /* ------------------------------------------
         5. For terminal statuses:

         completed
         cancelled
         rejected

         date/time/doctorId are NOT required.

         If not provided -> keep old values.
      -------------------------------------------*/

      /*
        إذا تم إرسال doctorId في حالة منتهية وكان
        مختلفًا عن الطبيب الحالي، نتحقق على الأقل
        من أن الطبيب يقدم نفس الخدمة.

        لا نفحص availability لأن الموعد لم يعد active.
      */
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

      /* ------------------------------------------
         6. Update TreatmentSession
      -------------------------------------------*/
      appointment.status = sessionStatus;

      if (typeof note === 'string') {
        appointment.note = note.trim();
      }

      /*
        مهم:

        لا نستخدم:
        appointment.date = null
        appointment.time = null
        appointment.doctorId = null

        في cancelled/rejected/completed.
      */

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

      /* ------------------------------------------
         Save Session first INSIDE transaction

         هذا مهم لأن حساب Treatment.status يجب أن
         يرى الحالة الجديدة للجلسة.
      -------------------------------------------*/
      await appointment.save({
        session: mongoSession,
      });

      /* ------------------------------------------
         7. Calculate Treatment.status
      -------------------------------------------*/
      let calculatedTreatmentStatus;

      /*
        ------------------------------
        Single Session Treatment
        ------------------------------
      */
      if (treatment.totalSessions === 1) {
        calculatedTreatmentStatus =
          getTreatmentStatusFromSingleSession(sessionStatus);
      } else {
        /*
          ------------------------------
          Multiple Sessions Treatment
          ------------------------------
        */
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

      /* ------------------------------------------
         8. treatmentStatus sent from frontend?

         Validate only.
         Frontend is not source of truth.
      -------------------------------------------*/
      validateRequestedTreatmentStatus({
        requestedStatus: treatmentStatus,
        calculatedStatus: calculatedTreatmentStatus,
      });

      /* ------------------------------------------
         9. Update Treatment
      -------------------------------------------*/
      const oldTreatmentStatus = treatment.status;

      treatment.status = calculatedTreatmentStatus;

      /* ------------------------------------------
         completedAt
      -------------------------------------------*/
      if (calculatedTreatmentStatus === 'completed') {
        /*
          لا نغير completedAt كل مرة لو هو
          مكتمل أصلًا.
        */
        if (oldTreatmentStatus !== 'completed' || !treatment.completedAt) {
          treatment.completedAt = new Date();
        }
      } else {
        /*
          إذا رجع العلاج من completed إلى
          أي حالة أخرى.
        */
        treatment.completedAt = null;
      }

      await treatment.save({
        session: mongoSession,
      });

      /* ------------------------------------------
         Store transaction results
      -------------------------------------------*/
      updatedSession = appointment.toObject();

      updatedTreatment = treatment.toObject();
    });

    /* ----------------------------------------------
       10. Success
    ------------------------------------------------*/
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
