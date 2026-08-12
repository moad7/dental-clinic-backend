import express from 'express';
import {
  createAppointment,
  getAllAppointments,
  updateAppointment,
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

export default router;
