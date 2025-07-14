import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAllServices,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController.js';

const router = express.Router();

router.get('/', protect, getAllServices);
router.post('/', protect, createService);
router.put('/:id', protect, updateService);
router.delete('/:id', protect, deleteService);

export default router;
