import express from 'express';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';
import {
  getAllDoctors,
  getDoctorAvailableSlots,
  getDoctorsByService,
} from '../controllers/doctorController.js';

const router = express.Router();

router.get('/getAllDoctors', protect, secretaryOnly, getAllDoctors);
router.post('/getDoctorsByService', protect, getDoctorsByService);
router.post('/doctorAvailableSlots', protect, getDoctorAvailableSlots);

export default router;
