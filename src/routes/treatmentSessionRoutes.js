import express from 'express';
import {
  createSession,
  updateSession,
  deleteSession,
  getSessionsByTreatment,
} from '../controllers/treatmentSessionController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createSession);
router.put('/:id', protect, updateSession);
router.delete('/:id', protect, deleteSession);
router.get('/:treatmentId', protect, getSessionsByTreatment);

export default router;
