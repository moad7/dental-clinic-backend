import cron from 'node-cron';
import { APPOINTMENT_AUTOMATION } from '../config/appointmentAutomation.js';
import { expireOverdueAppointments } from '../services/appointmentExpirationService.js';
export const startAppointmentExpirationJob = () => {
  const task = cron.schedule(
    APPOINTMENT_AUTOMATION.cronExpression,
    async () => {
      try {
        const result = await expireOverdueAppointments();
        console.log('[Appointment Automation]', {
          checked: result.checked,
          expired: result.expired,
          skipped: result.skipped,
          cancelledTreatments: result.cancelledTreatments,
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[Appointment Automation] Error:', error);
      }
    },
    {
      timezone: APPOINTMENT_AUTOMATION.timezone,
      noOverlap: true,
    },
  );
  console.log('[Appointment Automation] Cron started');
  return task;
};
