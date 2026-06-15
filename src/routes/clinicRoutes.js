import express from 'express';
import {
  createClinic,
  getAllClinics,
} from '../controllers/clinicController.js';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/createClinic', protect, secretaryOnly, createClinic);
router.get('/getAllClinics', protect, getAllClinics);

export default router;
