import mongoose from 'mongoose';
import User from '../../models/User.js';
import TreatmentSession from '../../models/TreatmentSession.js';

const SESSION_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'rejected',
];

const TREATMENT_STATUSES = [
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
];

export class AppointmentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppointmentError';
    this.statusCode = statusCode;
  }
}

/* --------------------------------------------------
   Validate Session Status
--------------------------------------------------- */
export const validateSessionStatus = (status) => {
  if (!status || !SESSION_STATUSES.includes(status)) {
    throw new AppointmentError('Invalid session status', 400);
  }
};

/* --------------------------------------------------
   Validate optional Treatment Status
--------------------------------------------------- */
export const validateTreatmentStatus = (status) => {
  if (status === undefined || status === null || status === '') {
    return;
  }

  if (!TREATMENT_STATUSES.includes(status)) {
    throw new AppointmentError('Invalid treatment status', 400);
  }
};

/* --------------------------------------------------
   Single Session:
   Session Status -> Treatment Status
--------------------------------------------------- */
export const getTreatmentStatusFromSingleSession = (sessionStatus) => {
  const statusMap = {
    pending: 'in_progress',
    confirmed: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'rejected',
  };

  return statusMap[sessionStatus] || 'in_progress';
};

/* --------------------------------------------------
   Multiple Sessions:
   Calculate Treatment Status from all sessions
--------------------------------------------------- */
export const calculateTreatmentStatusFromSessions = ({
  sessions,
  totalSessions,
}) => {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return 'in_progress';
  }

  const statuses = sessions.map((session) => session.status);

  /*
    مهم جدًا:
    العلاج لا يعتبر منتهيًا بالكامل إلا إذا تم إنشاء
    عدد الجلسات المتوقع على الأقل.
  */
  const hasAllExpectedSessions = sessions.length >= Number(totalSessions);

  const allCompleted = statuses.every((status) => status === 'completed');

  const allCancelled = statuses.every((status) => status === 'cancelled');

  const allRejected = statuses.every((status) => status === 'rejected');

  if (hasAllExpectedSessions && allCompleted) {
    return 'completed';
  }

  if (hasAllExpectedSessions && allCancelled) {
    return 'cancelled';
  }

  if (hasAllExpectedSessions && allRejected) {
    return 'rejected';
  }

  /*
    أي خليط آخر مثل:

    completed + pending
    completed + confirmed
    completed + cancelled
    cancelled + rejected
    pending + confirmed

    العلاج ما زال غير مكتمل.
  */
  return 'in_progress';
};

/* --------------------------------------------------
   Get weekday used in DoctorProfile.workingHours
--------------------------------------------------- */
const getWeekDayFromDate = (date) => {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppointmentError('Invalid appointment date', 400);
  }

  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  return days[parsedDate.getUTCDay()];
};

/* --------------------------------------------------
   Doctor validation

   - doctor exists
   - doctor
   - active when required
   - same service group
   - works that day
   - time inside workingHours
--------------------------------------------------- */
export const validateDoctorForTreatment = async ({
  doctorId,
  treatment,
  date,
  time,
  mongoSession,
  requireActive = true,
  checkWorkingHours = true,
}) => {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppointmentError('Invalid doctor id', 400);
  }

  const doctor = await User.findOne({
    _id: doctorId,
    role: 'doctor',
  })
    .select('_id name role isActive doctor.services doctor.workingHours')
    .session(mongoSession);

  if (!doctor) {
    throw new AppointmentError('Doctor not found', 404);
  }

  if (requireActive && !doctor.isActive) {
    throw new AppointmentError('Doctor is not active', 400);
  }

  const providesService = doctor.doctor?.services?.some(
    (service) => String(service.groupId) === String(treatment.serviceGroupId),
  );

  if (!providesService) {
    throw new AppointmentError(
      'Doctor does not provide this treatment service',
      400,
    );
  }

  if (!checkWorkingHours) {
    return doctor;
  }

  const weekDay = getWeekDayFromDate(date);

  const workingDay = doctor.doctor?.workingHours?.find(
    (workingHour) => workingHour.day === weekDay,
  );

  if (!workingDay || workingDay.isClosed) {
    throw new AppointmentError(
      'Doctor is not working on the selected day',
      400,
    );
  }

  /*
    HH:mm يمكن مقارنته مباشرة طالما التنسيق ثابت.
    مثال:
    09:00 <= 11:30 < 17:00
  */
  const isInsideWorkingHours =
    time >= workingDay.start && time < workingDay.end;

  if (!isInsideWorkingHours) {
    throw new AppointmentError(
      'Selected time is outside doctor working hours',
      400,
    );
  }

  return doctor;
};

/* --------------------------------------------------
   Check doctor time conflict
--------------------------------------------------- */
export const checkDoctorAvailability = async ({
  doctorId,
  dateRange,
  time,
  sessionId,
  mongoSession,
}) => {
  const conflict = await TreatmentSession.findOne({
    _id: {
      $ne: sessionId,
    },

    doctorId,

    time,

    status: {
      $in: ['pending', 'confirmed'],
    },

    date: {
      $gte: dateRange.start,
      $lt: dateRange.end,
    },
  })
    .select('_id')
    .session(mongoSession);

  if (conflict) {
    throw new AppointmentError(
      'Doctor already has an appointment at this date and time',
      409,
    );
  }

  return true;
};

/* --------------------------------------------------
   Check frontend Treatment Status

   frontend is NOT source of truth.
--------------------------------------------------- */
export const validateRequestedTreatmentStatus = ({
  requestedStatus,
  calculatedStatus,
}) => {
  if (
    requestedStatus === undefined ||
    requestedStatus === null ||
    requestedStatus === ''
  ) {
    return;
  }

  if (requestedStatus !== calculatedStatus) {
    throw new AppointmentError(
      `Treatment status conflict. Expected "${calculatedStatus}" based on session statuses, but received "${requestedStatus}".`,
      400,
    );
  }
};
