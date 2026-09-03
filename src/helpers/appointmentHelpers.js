import mongoose from 'mongoose';
import User from '../../models/User.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import { isValidTime } from '../utils/fuctions.js';

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
export const PATIENT_CALENDAR_SESSION_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'rejected',
];
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDateOnly = (value) => {
  if (!value || !DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const getDateOnlyValue = (date) => {
  if (!date) return null;

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};
export const addMonthsToDateOnly = (dateString, months) => {
  const [year, month, day] = dateString.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCMonth(date.getUTCMonth() + months);

  return date;
};

export const isRangeTooLarge = (from, to) => {
  const maxDate = addMonthsToDateOnly(from, 6);

  const [toYear, toMonth, toDay] = to.split('-').map(Number);

  const toDate = new Date(Date.UTC(toYear, toMonth - 1, toDay));

  return toDate > maxDate;
};

export const timeToMinutes = (time) => {
  if (!time || !isValidTime(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return null;
  }

  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;

  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const calculateEndTime = (startTime, durationMin) => {
  const startMinutes = timeToMinutes(startTime);
  const duration = Number(durationMin);

  if (startMinutes === null || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return minutesToTime(startMinutes + duration);
};
export const getCurrentDateAndTime = () => {
  const now = new Date();
  const date = getDateOnlyValue(now);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    date,
    time: `${hours}:${minutes}`,
  };
};
export const compareSessionDateTime = (appointment, nowDate, nowTime) => {
  const sessionDate = appointment.date;

  if (!sessionDate) {
    return 0;
  }

  if (sessionDate < nowDate) {
    return -1;
  }

  if (sessionDate > nowDate) {
    return 1;
  }

  if (appointment.startTime < nowTime) {
    return -1;
  }

  if (appointment.startTime > nowTime) {
    return 1;
  }

  return 0;
};
export const getCalendarHours = (appointments) => {
  const workingStarts = [];
  const workingEnds = [];
  appointments.forEach((appointment) => {
    const workingHours = appointment?._doctorWorkingHours || [];
    workingHours.forEach((workingDay) => {
      if (workingDay?.isClosed) {
        return;
      }
      if (isValidTime(workingDay?.start)) {
        workingStarts.push(workingDay.start);
      }
      if (isValidTime(workingDay?.end)) {
        workingEnds.push(workingDay.end);
      }
    });
  });
  if (workingStarts.length && workingEnds.length) {
    workingStarts.sort();
    workingEnds.sort();
    return {
      earliestTime: workingStarts[0],
      latestTime: workingEnds[workingEnds.length - 1],
    };
  }
  const startTimes = appointments
    .map((appointment) => appointment.startTime)
    .filter(Boolean)
    .sort();

  const endTimes = appointments
    .map((appointment) => appointment.endTime)
    .filter(Boolean)
    .sort();

  if (startTimes.length && endTimes.length) {
    return {
      earliestTime: startTimes[0],
      latestTime: endTimes[endTimes.length - 1],
    };
  }
  return {
    earliestTime: '08:00',
    latestTime: '18:00',
  };
};
export const normalizePatientCalendarSession = (session) => {
  const treatment = session.treatmentId;
  const doctor = session.doctorId;
  const serviceGroup = treatment?.serviceGroupId;
  const serviceItem =
    serviceGroup?.services?.find(
      (service) => String(service._id) === String(treatment?.serviceItemId),
    ) || null;
  const durationMin =
    serviceItem?.durationMin != null ? Number(serviceItem.durationMin) : null;
  const startTime = session.time;
  const endTime = calculateEndTime(startTime, durationMin);
  return {
    _id: session._id,
    treatmentId: treatment?._id || null,
    date: getDateOnlyValue(session.date),
    startTime,
    endTime,
    durationMin,
    sessionStatus: session.status,
    treatmentStatus: treatment?.status || null,
    doctor: doctor
      ? {
          _id: doctor._id,
          name: doctor.name,
          avatar: doctor.avatar || null,
        }
      : null,
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
          durationMin:
            serviceItem.durationMin != null
              ? Number(serviceItem.durationMin)
              : null,
          price: serviceItem.price != null ? Number(serviceItem.price) : null,
          photo: serviceItem.photo || null,
        }
      : null,
    clinic: doctor?.doctor?.clinic
      ? {
          _id: doctor.doctor.clinic._id,
          name: doctor.doctor.clinic.name,
          address: doctor.doctor.clinic.address || '',
        }
      : null,

    note: session.note || treatment?.note || '',
    _doctorWorkingHours: doctor?.doctor?.workingHours || [],
  };
};
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
