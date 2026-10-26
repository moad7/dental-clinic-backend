// src/routes/patientRoutes.js
import express from 'express';
import { authorize, protect } from '../middleware/authMiddleware.js';
import {
  getMyPatientProfile,
  updateMyPatientProfile,
  getMyAppointments,
  getMyTreatments,
  getAllPatients,
  getPatientFullProfile,
} from '../controllers/patientController.js';
const router = express.Router();
router.get('/me/profile', protect, getMyPatientProfile);
router.put('/me/profile', protect, updateMyPatientProfile);
router.get('/me/appointments', protect, getMyAppointments);
router.get('/me/treatments', protect, getMyTreatments);
router.get(
  '/getAllPatients',
  protect,
  authorize('secretary', 'doctor'),
  getAllPatients,
);
router.get(
  '/:patientId/full-details',
  protect,
  authorize('secretary', 'doctor'),
  getPatientFullProfile,
);
export default router;
