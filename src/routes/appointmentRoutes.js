import express from 'express';
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAllAppointments,
  getMyAppointments,
  getTodayAppointments,
  checkAvailability,
} from '../controllers/appointmentController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createAppointment);
router.put('/:id', protect, updateAppointment);
router.delete('/:id', protect, deleteAppointment);
router.get('/', protect, getAllAppointments);
router.get('/mine', protect, getMyAppointments);
router.get('/today', protect, getTodayAppointments);
router.get('/check', protect, checkAvailability);

export default router;
