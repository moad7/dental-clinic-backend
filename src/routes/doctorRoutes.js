import express from 'express';
import { protect, secretaryOnly } from '../middleware/authMiddleware.js';
import { getAllDoctors } from '../controllers/doctorController.js';

const router = express.Router();

router.get('/getAllDoctors', protect, secretaryOnly, getAllDoctors);

export default router;
