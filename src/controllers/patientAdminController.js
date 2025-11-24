// src/controllers/patientAdminController.js
import User from "../../models/User.js";
import Patient from "../../models/Patient.js";
import Appointment from "../../models/Appointment.js";
import Treatment from "../../models/Treatment.js";
import TreatmentSession from "../../models/TreatmentSession.js";
import Service from "../../models/Service.js";

// helper بسيط
const isStaff = (req) =>
  req.user?.role === "secretary" || req.user?.role === "doctor";

/**
 * GET /api/admin/patients
 * سكرتيرة / دكتور يشوفون قائمة المرضى
 */
export const adminGetAllPatients = async (req, res) => {
  if (!isStaff(req)) {
    return res.status(403).json({ message: "Only staff can view patients" });
  }

  try {
    const patients = await User.find({ role: "patient" })
      .select("name phoneNumber email role avatar createdAt")
      .populate({
        path: "patient",
        select: "age gender allergies notes",
        model: Patient,
      })
      .sort({ createdAt: -1 })
      .lean();

    const mapped = patients.map((u) => ({
      ...u,
      id: u._id,
    }));

    res.status(200).json(mapped);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch patients", error: err.message });
  }
};

/**
 * GET /api/admin/patients/:id
 * سكرتيرة / دكتور يشوف تفاصيل مريض معيّن
 */
export const adminGetPatientDetails = async (req, res) => {
  if (!isStaff(req)) {
    return res.status(403).json({ message: "Only staff can view patient details" });
  }

  try {
    const user = await User.findOne({ _id: req.params.id, role: "patient" })
      .select("name phoneNumber email role avatar")
      .populate({
        path: "patient",
        select: "age gender allergies notes",
        model: Patient,
      })
      .populate({
        path: "Appointments",
        select: "date time status note",
        options: { sort: { date: 1, time: 1 } },
        model: Appointment,
        populate: [
          {
            path: "Treatments",
            select: "serviceId totalSessions note status createdAt",
            model: Treatment,
            populate: [
              {
                path: "Sessions",
                select: "date time note status",
                options: { sort: { date: 1, time: 1 } },
                model: TreatmentSession,
              },
              {
                path: "serviceId",
                select: "title services",
                model: Service,
              },
            ],
          },
        ],
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    user.id = user._id;
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to fetch patient", error: err.message });
  }
};

/**
 * PUT /api/admin/patients/:id
 * سكرتيرة / دكتور يعدّل بيانات مريض
 */
export const adminUpdatePatient = async (req, res) => {
  if (!isStaff(req)) {
    return res.status(403).json({ message: "Only staff can update patients" });
  }

  try {
    const { name, phoneNumber, email, avatar, age, gender, allergies, notes } =
      req.body;

    const user = await User.findOne({ _id: req.params.id, role: "patient" });
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

    res.status(200).json({ message: "Patient updated successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update patient", error: err.message });
  }
};

/**
 * DELETE /api/admin/patients/:id
 * سكرتيرة / دكتور يحذف مريض
 */
export const adminDeletePatient = async (req, res) => {
  if (!isStaff(req)) {
    return res.status(403).json({ message: "Only staff can delete patients" });
  }

  try {
    const user = await User.findOneAndDelete({
      _id: req.params.id,
      role: "patient",
    });
    if (!user) return res.status(404).json({ message: "Patient not found" });

    await Patient.deleteOne({ userId: user._id });
    // لو تبغى لاحقاً تحذف appointments/treatments الخاصة فيه، نضيفها هنا

    res.status(200).json({ message: "Patient deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete patient", error: err.message });
  }
};
