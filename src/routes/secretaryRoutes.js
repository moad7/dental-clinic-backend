import express from 'express';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';
import {
  createDoctorBySecretary,
  getAllPatientBySecretary,
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

export default router;
