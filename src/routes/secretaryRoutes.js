import express from 'express';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';
import {
  createDoctorBySecretary,
  getAllPatientBySecretary,
  getAvailableDoctors,
} from '../controllers/secretaryController.js';

const router = express.Router();

router.post(
  '/createDoctorBySecretary',
  protect,
  secretaryOnly,
  createDoctorBySecretary,
);
router.get(
  '/getAllPatientBySecretary',
  protect,
  secretaryOnly,
  getAllPatientBySecretary,
);
router.post('/availableDoctors', protect, secretaryOnly, getAvailableDoctors);

export default router;
