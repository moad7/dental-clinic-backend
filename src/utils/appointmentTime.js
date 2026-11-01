import { DateTime } from 'luxon';
import { APPOINTMENT_AUTOMATION } from '../config/appointmentAutomation.js';
export const getAppointmentDeadline = (
  date,
  time,
  durationMin = APPOINTMENT_AUTOMATION.defaultDurationMin,
) => {
  if (!date || !time) return null;
  // عندك date محفوظ كـ UTC midnight
  const dateOnly = DateTime.fromJSDate(new Date(date), {
    zone: 'utc',
  }).toISODate();
  if (!dateOnly) return null;
  // تحويل تاريخ وساعة الموعد إلى توقيت إسرائيل
  const appointmentStart = DateTime.fromISO(`${dateOnly}T${time}`, {
    zone: APPOINTMENT_AUTOMATION.timezone,
  });
  if (
    !appointmentStart.isValid ||
    appointmentStart.toFormat('HH:mm') !== time
  ) {
    return null;
  }
  const duration = Number(durationMin);
  if (!Number.isFinite(duration) || duration < 5) {
    return null;
  }
  // وقت نهاية الجلسة + مهلة التأخير
  return appointmentStart.plus({
    minutes: duration + APPOINTMENT_AUTOMATION.graceMinutes,
  });
};
export const isAppointmentExpired = (date, time, durationMin) => {
  const deadline = getAppointmentDeadline(date, time, durationMin);
  if (!deadline) return false;
  return DateTime.now() >= deadline;
};
