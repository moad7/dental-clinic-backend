import express from 'express';

import {
  getAllPatients,
  updateUser,
  deleteUser,
  getPatientDetails,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

router.get('/patients', protect, getAllPatients);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, deleteUser);
router.get('/:id/details', protect, getPatientDetails);

export default router;
