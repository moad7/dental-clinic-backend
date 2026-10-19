import express from 'express';
import {
  authorize,
  protect,
  secretaryOnly,
} from '../middleware/authMiddleware.js';
import {
  getAllDoctors,
  getDoctorAppointments,
  getDoctorAvailableSlots,
  getDoctorDashboard,
  getDoctorsByService,
} from '../controllers/doctorController.js';
const router = express.Router();
router.get('/getAllDoctors', protect, getAllDoctors);
router.post('/getDoctorsByService', protect, getDoctorsByService);
router.post('/doctorAvailableSlots', protect, getDoctorAvailableSlots);
router.get('/dashboard', protect, authorize('doctor'), getDoctorDashboard);
router.get(
  '/appointments',
  protect,
  authorize('doctor'),
  getDoctorAppointments,
);
export default router;
