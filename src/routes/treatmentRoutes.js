import express from 'express';
import {
  createTreatment,
  createTreatmentSession,
  getAllTreatments,
  getMyTreatments,
  getTreatmentSessions,
  updateTreatment,
} from '../controllers/treatmentController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/:treatmentId/sessions', protect, createTreatmentSession);
router.get('/:treatmentId/sessions', protect, getTreatmentSessions);

router.post('/', protect, createTreatment);
router.get('/', protect, getAllTreatments);
router.get('/mine', protect, getMyTreatments);
router.put('/:id', protect, updateTreatment);

export default router;
