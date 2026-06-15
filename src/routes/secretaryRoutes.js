import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createDoctorBySecretary } from '../controllers/secretaryController.js';

const router = express.Router();

router.post('/createDoctorBySecretary', protect, createDoctorBySecretary);

export default router;
