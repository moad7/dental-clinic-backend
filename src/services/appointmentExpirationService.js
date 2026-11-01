import { DateTime } from 'luxon';
import TreatmentSession from '../../models/TreatmentSession.js';
import Treatment from '../../models/Treatment.js';
import Service from '../../models/Service.js';
import { APPOINTMENT_AUTOMATION } from '../config/appointmentAutomation.js';
import { getAppointmentDeadline } from '../utils/appointmentTime.js';
import { calculateTreatmentStatusFromSessions } from '../helpers/appointmentHelpers.js';
import mongoose from 'mongoose';
export const expireOverdueAppointments = async () => {
  const now = DateTime.now().setZone(APPOINTMENT_AUTOMATION.timezone);
  const todayUTC = new Date(`${now.toISODate()}T00:00:00.000Z`);
  // 1. جميع المواعيد النشطة حتى تاريخ اليوم
  const appointments = await TreatmentSession.find({
    status: { $in: ['pending', 'confirmed'] },
    date: { $lte: todayUTC },
  })
    .select('_id treatmentId date time status')
    .lean();
  // 2. جلب العلاجات المرتبطة بالمواعيد
  const treatmentIds = [
    ...new Set(appointments.map((item) => String(item.treatmentId))),
  ];
  const treatments = await Treatment.find({
    _id: { $in: treatmentIds },
  })
    .select('_id serviceGroupId serviceItemId')
    .lean();
  const treatmentMap = new Map(
    treatments.map((item) => [String(item._id), item]),
  );
  // 3. جلب مجموعات الخدمات
  const groupIds = [
    ...new Set(
      treatments
        .map((item) => item.serviceGroupId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const groups = await Service.find({
    _id: { $in: groupIds },
  })
    .select('_id services')
    .lean();
  const groupMap = new Map(groups.map((item) => [String(item._id), item]));
  let expired = 0;
  let skipped = 0;
  const affectedTreatmentIds = new Set();
  // 4. فحص كل موعد
  for (const appointment of appointments) {
    const treatment = treatmentMap.get(String(appointment.treatmentId));
    const group = treatment
      ? groupMap.get(String(treatment.serviceGroupId))
      : null;
    const serviceItem = group?.services?.find(
      (item) => String(item._id) === String(treatment?.serviceItemId),
    );
    const durationMin =
      serviceItem?.durationMin ?? APPOINTMENT_AUTOMATION.defaultDurationMin;
    const deadline = getAppointmentDeadline(
      appointment.date,
      appointment.time,
      durationMin,
    );
    if (!deadline) {
      skipped++;
      continue;
    }
    // الموعد لم ينتهِ بعد
    if (now < deadline) continue;
    // 5. تحديث مشروط لحماية تعديل السكرتيرة
    const result = await TreatmentSession.updateOne(
      {
        _id: appointment._id,
        status: appointment.status,
        date: appointment.date,
        time: appointment.time,
      },
      {
        $set: {
          status: 'expired',
          expiredAt: new Date(),
        },
      },
    );
    if (result.modifiedCount === 1) {
      expired++;
      affectedTreatmentIds.add(String(appointment.treatmentId));
    }
  }
  // --------------------------------------
  // Update affected treatments
  // --------------------------------------
  // Include treatments with previously expired sessions
  // that may not have been synchronized yet.
  const previousExpiredSessions = await TreatmentSession.find({
    status: 'expired',
  })
    .select('treatmentId')
    .lean();
  for (const session of previousExpiredSessions) {
    if (session.treatmentId) {
      affectedTreatmentIds.add(String(session.treatmentId));
    }
  }
  // --------------------------------------
  let cancelledTreatments = 0;
  for (const treatmentId of affectedTreatmentIds) {
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        const treatment =
          await Treatment.findById(treatmentId).session(mongoSession);
        if (!treatment || treatment.status !== 'in_progress') {
          return;
        }
        const sessions = await TreatmentSession.find({
          treatmentId,
        })
          .select('_id status')
          .session(mongoSession)
          .lean();
        const calculatedStatus = calculateTreatmentStatusFromSessions({
          sessions,
          totalSessions: treatment.totalSessions,
        });
        if (calculatedStatus !== 'cancelled') {
          return;
        }
        const allExpired =
          sessions.length >= Number(treatment.totalSessions) &&
          sessions.every((session) => session.status === 'expired');
        if (!allExpired) return;
        treatment.status = 'cancelled';
        treatment.completedAt = null;
        await treatment.save({ session: mongoSession });
        cancelledTreatments++;
      });
    } catch (error) {
      console.error(
        `[Appointment Automation] Treatment ${treatmentId}:`,
        error,
      );
    } finally {
      await mongoSession.endSession();
    }
  }
  return {
    checked: appointments.length,
    expired,
    skipped,
    cancelledTreatments,
  };
};
