// src/routes/patientRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getMyPatientProfile,
  updateMyPatientProfile,
  getMyAppointments,
  getMyTreatments,
} from '../controllers/patientController.js';

const router = express.Router();

router.get('/me/profile', protect, getMyPatientProfile);
router.put('/me/profile', protect, updateMyPatientProfile);
router.get('/me/appointments', protect, getMyAppointments);
router.get('/me/treatments', protect, getMyTreatments);

export default router;
