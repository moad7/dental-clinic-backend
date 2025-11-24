// src/controllers/treatmentController.js
import Treatment from "../../models/Treatment.js";
import User from "../../models/User.js";
import Service from "../../models/Service.js";

// helper: يجيب هوية المستخدم الحالي من الميدلوير
function currentUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.sub;
}

// POST /api/treatments
export const createTreatment = async (req, res) => {
  const { userId, serviceId, totalSessions, note } = req.body;

  if (req.user.role !== "secretary" && req.user.role !== "doctor") {
    return res.status(403).json({ message: "Only secretaries or doctors can create treatments" });
  }
  if (!userId || !serviceId || !totalSessions) {
    return res.status(400).json({ message: "userId, serviceId and totalSessions are required" });
  }

  try {
    const treatment = await Treatment.create({
      userId,
      serviceId,
      totalSessions: Number(totalSessions),
      note,
    });

    res.status(201).json({ message: "Treatment created successfully", treatment });
  } catch (err) {
    res.status(500).json({ message: "Failed to create treatment", error: err.message });
  }
};

// GET /api/treatments
export const getAllTreatments = async (req, res) => {
  if (req.user.role !== "doctor" && req.user.role !== "secretary") {
    return res.status(403).json({ message: "Unauthorized to view treatments" });
  }

  try {
    const treatments = await Treatment.find({})
      .populate({ path: "userId", select: "id name phoneNumber", model: User }) // as: patient
      .populate({ path: "serviceId", select: "id name price", model: Service })
      .sort({ createdAt: -1 })
      .lean();

    // لمواءمة alias القديمة (as: 'patient')
    const mapped = treatments.map(t => ({
      ...t,
      patient: t.userId,
    }));

    res.status(200).json(mapped);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch treatments", error: err.message });
  }
};

// GET /api/treatments/mine
export const getMyTreatments = async (req, res) => {
  if (req.user.role !== "patient") {
    return res.status(403).json({ message: "Only patients can access their own treatments" });
  }

  try {
    const me = currentUserId(req);
    const treatments = await Treatment.find({ userId: me })
      .populate({ path: "serviceId", model: Service }) // كل تفاصيل الخدمة
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(treatments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch treatments", error: err.message });
  }
};

// PUT /api/treatments/:id
export const updateTreatment = async (req, res) => {
  const { id } = req.params;
  const { totalSessions, note, status, serviceId } = req.body;

  if (req.user.role !== "secretary" && req.user.role !== "doctor") {
    return res.status(403).json({ message: "Only secretaries or doctors can update treatments" });
  }

  try {
    const treatment = await Treatment.findById(id);
    if (!treatment) return res.status(404).json({ message: "Treatment not found" });

    if (totalSessions !== undefined) treatment.totalSessions = Number(totalSessions);
    if (note !== undefined) treatment.note = note;
    if (status !== undefined) treatment.status = status;
    if (serviceId !== undefined) treatment.serviceId = serviceId;

    await treatment.save();

    res.status(200).json({ message: "Treatment updated successfully", treatment });
  } catch (err) {
    res.status(500).json({ message: "Failed to update treatment", error: err.message });
  }
};
