import express from 'express';
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAllAppointments,
  getMyAppointments,
  getTodayAppointments,
  checkAvailability,
} from '../controllers/appointmentController.js';

import { protect,authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post("/", protect, authorize("secretary", "patient"), createAppointment);
router.put("/:id", protect, authorize("secretary", "patient"), updateAppointment);
router.delete("/:id", protect, authorize("secretary", "patient"), deleteAppointment);
router.get("/", protect, authorize("secretary", "doctor"), getAllAppointments);
router.get("/mine", protect, authorize("patient"), getMyAppointments);
router.get("/today", protect, authorize("secretary", "doctor"), getTodayAppointments);
router.get("/check", protect, checkAvailability);


export default router;
