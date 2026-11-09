import express from 'express';
import {
  protect,
  secretaryOnly,
  authorize,
} from '../middleware/authMiddleware.js';
import {
  createDoctorBySecretary,
  createPatientBySecretary,
  renewActivationLink,
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
router.patch(
  '/:userId/renew-activation',
  protect,
  secretaryOnly,
  renewActivationLink,
);
export default router;
