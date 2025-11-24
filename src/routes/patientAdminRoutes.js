// src/routes/patientAdminRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  adminGetAllPatients,
  adminGetPatientDetails,
  adminUpdatePatient,
  adminDeletePatient,
} from "../controllers/patientAdminController.js";

const router = express.Router();

router.use(protect);

router.get("/", adminGetAllPatients);
router.get("/:id", adminGetPatientDetails);
router.put("/:id", adminUpdatePatient);
router.delete("/:id", adminDeletePatient);

export default router;
