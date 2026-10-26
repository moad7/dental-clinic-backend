import express from 'express';
import {
  protect,
  secretaryOnly,
  authorize,
} from '../middleware/authMiddleware.js';
import {
  createDoctorBySecretary,
  createPatientBySecretary,
  updateDoctorBySecretary,
} from '../controllers/secretaryController.js';
const router = express.Router();
router.post(
  '/createDoctorBySecretary',
  protect,
  secretaryOnly,
  createDoctorBySecretary,
);
router.put(
  '/updateDoctorBySecretary/:doctorId',
  protect,
  secretaryOnly,
  updateDoctorBySecretary,
);
router.post(
  '/createPatientsBySecretary',
  protect,
  secretaryOnly,
  createPatientBySecretary,
);
export default router;
