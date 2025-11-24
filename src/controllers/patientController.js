// src/controllers/patientController.js
import User from "../../models/User.js";
import Patient from "../../models/Patient.js";
import Appointment from "../../models/Appointment.js";
import Treatment from "../../models/Treatment.js";
import TreatmentSession from "../../models/TreatmentSession.js";
import Service from "../../models/Service.js";

const currentUserId = (req) => req.user?.userId || req.user?._id || req.user?.sub;

/**
 * GET /api/patients/me/profile
 * المريض يشوف بروفايله نفسه
 */
export const getMyPatientProfile = async (req, res) => {
  try {
    const id = currentUserId(req);

    const user = await User.findOne({ _id: id, role: "patient" })
      .select("name phoneNumber email role avatar")
      .populate({
        path: "patient",
        select: "age gender allergies notes",
        model: Patient,
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    user.id = user._id;
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch patient profile",
      error: err.message,
    });
  }
};

/**
 * PUT /api/patients/me/profile
 * المريض يعدّل بروفايله بنفسه
 */
export const updateMyPatientProfile = async (req, res) => {
  try {
    const id = currentUserId(req);

    if (req.user.role !== "patient") {
      return res.status(403).json({ message: "Only patients can update their profile" });
    }

    const { name, phoneNumber, email, avatar, age, gender, allergies, notes } = req.body;

    const user = await User.findOne({ _id: id, role: "patient" });
    if (!user) return res.status(404).json({ message: "Patient not found" });

    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    let patient = await Patient.findOne({ userId: user._id });
    if (!patient) {
      patient = new Patient({ userId: user._id });
    }

    if (age !== undefined) patient.age = age;
    if (gender !== undefined) patient.gender = gender;
    if (allergies !== undefined) patient.allergies = allergies;
    if (notes !== undefined) patient.notes = notes;

    await patient.save();

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update patient profile",
      error: err.message,
    });
  }
};

/**
 * GET /api/patients/me/appointments
 */
export const getMyAppointments = async (req, res) => {
  try {
    const id = currentUserId(req);

    const appointments = await Appointment.find({ userId: id })
      .select("date time status note")
      .sort({ date: 1, time: 1 })
      .lean();

    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch my appointments",
      error: err.message,
    });
  }
};

/**
 * GET /api/patients/me/treatments
 */
export const getMyTreatments = async (req, res) => {
  try {
    const id = currentUserId(req);

    const treatments = await Treatment.find({ userId: id })
      .populate({ path: "serviceId", select: "title services", model: Service })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(treatments);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch my treatments",
      error: err.message,
    });
  }
};
