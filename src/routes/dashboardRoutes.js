import express from 'express';
import {
  getDashboardSummary,
  getUpcomingAppointmentsForCalendar,
} from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);
router.get('/calendar', protect, getUpcomingAppointmentsForCalendar);

export default router;
