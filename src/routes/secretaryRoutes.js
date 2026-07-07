import express from 'express';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';
import {
  createDoctorBySecretary,
  createPatientBySecretary,
  getAllPatientBySecretary,
  getPatientFullDetailsBySecretary,
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
router.post(
  '/createPatientsBySecretary',
  protect,
  secretaryOnly,
  createPatientBySecretary,
);
router.get(
  '/patients/:patientId/full-details',
  protect,
  secretaryOnly,
  getPatientFullDetailsBySecretary,
);

export default router;
