import Service from '../../models/Service.js';
import TreatmentSession from '../../models/TreatmentSession.js';
export const CONFLICT_STATUSES = ['pending', 'confirmed'];
export const timeToMinutes = (time) => {
  if (!time || typeof time !== 'string') {
    return null;
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};
export const hasTimeOverlap = (startA, endA, startB, endB) => {
  return startA < endB && endA > startB;
};
/**
 * Get service item from a ServiceGroup.
 */
export const getServiceItem = async (serviceGroupId, serviceItemId) => {
  const serviceGroup = await Service.findById(serviceGroupId).lean();
  if (!serviceGroup) {
    return {
      serviceGroup: null,
      serviceItem: null,
    };
  }
  const serviceItem = serviceGroup.services?.find(
    (item) => String(item._id) === String(serviceItemId),
  );
  return {
    serviceGroup,
    serviceItem: serviceItem || null,
  };
};
/**
 * Returns all conflicting periods for a doctor on one day.
 */
export const getDoctorBookedPeriods = async ({ doctorId, dateRange }) => {
  const bookedSessions = await TreatmentSession.find({
    doctorId,
    status: {
      $in: CONFLICT_STATUSES,
    },
    date: {
      $gte: dateRange.start,
      $lt: dateRange.end,
    },
  })
    .select('time treatmentId status')
    .populate({
      path: 'treatmentId',
      select: 'serviceGroupId serviceItemId',
    })
    .lean();
  if (!bookedSessions.length) {
    return [];
  }
  /*
   * Get all ServiceGroup IDs used by the
   * existing appointments in one query.
   */
  const serviceGroupIds = [
    ...new Set(
      bookedSessions
        .map((session) => session.treatmentId?.serviceGroupId?.toString())
        .filter(Boolean),
    ),
  ];
  const serviceGroups = serviceGroupIds.length
    ? await Service.find({
        _id: {
          $in: serviceGroupIds,
        },
      }).lean()
    : [];
  const serviceGroupMap = new Map(
    serviceGroups.map((group) => [String(group._id), group]),
  );
  return bookedSessions
    .map((session) => {
      const treatment = session.treatmentId;
      if (!treatment) {
        return null;
      }
      const serviceGroup = serviceGroupMap.get(
        String(treatment.serviceGroupId),
      );
      if (!serviceGroup) {
        return null;
      }
      const serviceItem = serviceGroup.services?.find(
        (item) => String(item._id) === String(treatment.serviceItemId),
      );
      if (!serviceItem) {
        return null;
      }
      const durationMin = Number(serviceItem.durationMin);
      const start = timeToMinutes(session.time);
      if (start === null || !Number.isFinite(durationMin) || durationMin <= 0) {
        return null;
      }
      return {
        sessionId: session._id,
        time: session.time,
        start,
        end: start + durationMin,
        durationMin,
      };
    })
    .filter(Boolean);
};
/**
 * Check whether a requested appointment conflicts
 * with any existing doctor appointment.
 */
export const hasDoctorTimeConflict = ({
  startTime,
  durationMin,
  bookedPeriods,
}) => {
  const start = timeToMinutes(startTime);
  if (start === null) {
    return true;
  }
  const duration = Number(durationMin);
  if (!Number.isFinite(duration) || duration <= 0) {
    return true;
  }
  const end = start + duration;
  return bookedPeriods.some((period) =>
    hasTimeOverlap(start, end, period.start, period.end),
  );
};
