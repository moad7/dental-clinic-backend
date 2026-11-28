// src/routes/patientRoutes.js
import express from 'express';
import { authorize, protect } from '../middleware/authMiddleware.js';
import {
  deletePatientAccount,
  getAllPatients,
  getPatientFullProfile,
} from '../controllers/patientController.js';
const router = express.Router();

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
router.delete(
  '/patients/me',
  protect,
  authorize('patient'),
  deletePatientAccount,
);

router.delete(
  '/patients/:userId',
  protect,
    authorize('secretary'),
  deletePatientAccount,
);





export default router;
