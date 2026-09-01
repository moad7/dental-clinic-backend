import express from 'express';
import {
  createAppointment,
  getAllAppointments,
  secretaryAppointmentDecision,
  updateAppointment,
  getTodayAppointments,
} from '../controllers/appointmentController.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post(
  '/createAppointment',
  protect,
  authorize('secretary', 'patient'),
  createAppointment,
);
router.patch('/updateAppointment/:appointmentId', protect, updateAppointment);
router.get('/', protect, authorize('secretary', 'doctor'), getAllAppointments);
router.patch(
  '/decision/:appointmentId',
  protect,
  authorize('secretary'),
  secretaryAppointmentDecision,
);

router.get('/today', protect, authorize('secretary'), getTodayAppointments);
export default router;
