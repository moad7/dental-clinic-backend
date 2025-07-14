import express from 'express';
import {
  createTreatment,
  getAllTreatments,
  getMyTreatments,
  updateTreatment,
} from '../controllers/treatmentController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createTreatment);
router.get('/', protect, getAllTreatments);
router.get('/mine', protect, getMyTreatments);
router.put('/:id', protect, updateTreatment);

export default router;
