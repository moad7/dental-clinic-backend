// src/controllers/dashboardController.js
import User from "../../models/User.js";
import Treatment from "../../models/Treatment.js";
import TreatmentSession from '../../models/TreatmentSession.js';

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

const getIsraelDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
};

const getDateOnlyUTC = (dateString) =>
  new Date(`${dateString}T00:00:00.000Z`);
const getTodayUTC = () => getDateOnlyUTC(getIsraelDate());
const getMonthStartUTC = () => {
  const today = getIsraelDate();
  return getDateOnlyUTC(`${today.slice(0, 7)}-01`);
};

const getSessionStats = async (filter = {}) => {
  const [pending, confirmed, completed, total] =
    await Promise.all([
      TreatmentSession.countDocuments({
        ...filter,
        status: 'pending',
      }),
      TreatmentSession.countDocuments({
        ...filter,
        status: 'confirmed',
      }),
      TreatmentSession.countDocuments({
        ...filter,
        status: 'completed',
      }),
      TreatmentSession.countDocuments(filter),
    ]);

  return { pending, confirmed, completed, total };
};

/* ==========================================
   SECRETARY - OVERVIEW
========================================== */
const getSecretaryOverview = async () => {
  const today = getTodayUTC();

  const [
    patients,
    activeDoctors,
    pendingRequests,
    appointmentsToday,
  ] = await Promise.all([
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({
      role: 'doctor',
      isActive: true,
    }),
    TreatmentSession.countDocuments({
      status: 'pending',
    }),
    TreatmentSession.countDocuments({
      date: today,
      status: {
        $in: ['pending', 'confirmed', 'completed'],
      },
    }),
  ]);

  return {
    patients,
    doctors: activeDoctors,
    requests: pendingRequests,
    appointments: appointmentsToday,
  };
};

/* ==========================================
   SECRETARY - PATIENTS
========================================== */
const getSecretaryPatients = async () => {
  const monthStart = getMonthStartUTC();

  const [
    patients,
    activePatients,
    newPatientsThisMonth,
    awaitingActivation,
  ] = await Promise.all([
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({
      role: 'patient',
      isActive: true,
    }),
    User.countDocuments({
      role: 'patient',
      createdAt: { $gte: monthStart },
    }),
    User.countDocuments({
      role: 'patient',
      mustSetPassword: true,
    }),
  ]);

  return {
    patients,
    activePatients,
    newPatientsThisMonth,
    awaitingActivation,
  };
};

/* ==========================================
   SECRETARY - DOCTORS
========================================== */
const getSecretaryDoctors = async () => {
  const today = getTodayUTC();

  const [
    doctors,
    activeDoctors,
    awaitingActivation,
    doctorsWithAppointments,
  ] = await Promise.all([
    User.countDocuments({ role: 'doctor' }),
    User.countDocuments({
      role: 'doctor',
      isActive: true,
    }),
    User.countDocuments({
      role: 'doctor',
      mustSetPassword: true,
    }),
    TreatmentSession.distinct('doctorId', {
      date: today,
      status: {
        $in: ['pending', 'confirmed', 'completed'],
      },
    }),
  ]);

  return {
    doctors,
    activeDoctors,
    awaitingActivation,
    doctorsWithAppointments: doctorsWithAppointments.length,
  };
};

/* ==========================================
   DOCTOR - OVERVIEW
========================================== */
const getDoctorOverview = async (doctorId) => {
  const today = getTodayUTC();

  const [
    incomingPatients,
    completedToday,
    pendingRequests,
    appointmentsToday,
  ] = await Promise.all([
    TreatmentSession.distinct('treatmentId', {
      doctorId,
      date: today,
      status: 'confirmed',
    }),
    TreatmentSession.countDocuments({
      doctorId,
      date: today,
      status: 'completed',
    }),
    TreatmentSession.countDocuments({
      doctorId,
      status: 'pending',
    }),
    TreatmentSession.countDocuments({
      doctorId,
      date: today,
      status: {
        $in: ['pending', 'confirmed', 'completed'],
      },
    }),
  ]);

  return {
    incomingPatients: incomingPatients.length,
    completedRequests: completedToday,
    requests: pendingRequests,
    appointments: appointmentsToday,
  };
};

/* ==========================================
   PATIENT - OVERVIEW
========================================== */
const getPatientOverview = async (patientId) => {
  const today = getTodayUTC();
  const nowTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISRAEL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

  const treatments = await Treatment.find({
    userId: patientId,
  })
    .select('_id status')
    .lean();

  const treatmentIds = treatments.map((t) => t._id);

  const activeTreatments = treatments.filter(
    (t) => t.status === 'in_progress',
  ).length;

  if (treatmentIds.length === 0) {
    return {
      pendingRequests: 0,
      completedRequests: 0,
      nextAppointment: null,
      activeTreatments,
    };
  }

  const [
    pendingRequests,
    completedRequests,
    nextAppointment,
  ] = await Promise.all([
    TreatmentSession.countDocuments({
      treatmentId: { $in: treatmentIds },
      status: 'pending',
    }),
    TreatmentSession.countDocuments({
      treatmentId: { $in: treatmentIds },
      status: 'completed',
    }),
    TreatmentSession.findOne({
      treatmentId: { $in: treatmentIds },
      status: 'confirmed',
      $or: [
        { date: { $gt: today } },
        {
          date: today,
          time: { $gte: nowTime },
        },
      ],
    })
      .sort({ date: 1, time: 1 })
      .select('date time doctorId')
      .lean(),
  ]);

  return {
    pendingRequests,
    completedRequests,
    nextAppointment: nextAppointment
      ? {
          date: nextAppointment.date,
          time: nextAppointment.time,
          doctorId: nextAppointment.doctorId,
        }
      : null,
    activeTreatments,
  };
};

/* ==========================================
   MAIN CONTROLLER
========================================== */
export const getDashboardStats = async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.userId;
    console.log('getDashboardStats called with role:', role, 'userId:', userId);
    const { view = 'overview' } = req.query;

    if (!userId || !role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    let stats;

    if (role === 'secretary') {
      if (view === 'overview') {
        stats = await getSecretaryOverview();
      } else if (view === 'patients') {
        stats = await getSecretaryPatients();
      } else if (view === 'doctors') {
        stats = await getSecretaryDoctors();
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid dashboard view',
        });
      }
    } else if (role === 'doctor') {
      if (view === 'overview') {
       stats = await getDoctorOverview(userId);
      } else if (view === 'patients') {
        stats = await getSecretaryPatients();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Invalid dashboard view',
        });
      }
      

     
    } else if (role === 'patient') {
      if (view !== 'overview') {
        return res.status(403).json({
          success: false,
          message: 'Dashboard view not allowed',
        });
      }

      stats = await getPatientOverview(userId);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unsupported user role',
      });
    }

    return res.status(200).json({
      success: true,
      role,
      view,
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
  }
};
