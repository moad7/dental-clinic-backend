// src/controllers/userController.js
import User from "../../models/User.js";
import Appointment from "../../models/Appointment.js";
import Treatment from "../../models/Treatment.js";
import TreatmentSession from "../../models/TreatmentSession.js";

// ملاحظة مهمة:
// عشان populate المتداخل يشتغل مثل include القديم:
// - لازم يكون عندك virtuals التالية:
//   * في User: "Appointments" و "treatments" (سوّيناها قبل)
//   * في Treatment: "Sessions" (سوّيناها قبل)
//   * في Appointment: "Treatments" (أضِف السطر التالي في models/Appointment.js):
//     AppointmentSchema.virtual("Treatments", {
//       ref: "Treatment",
//       localField: "_id",
//       foreignField: "appointmentId",
//     });

/** GET /api/users  (اسمك يقول Patients بس كودك الأصلي يرجّع كل المستخدمين)
 *  لو تبغى فقط المرضى فعّل الفلتر role: 'patient'
 */
export const getAllPatients = async (req, res) => {
  try {
    // إن أردت حصرهم على المرضى فقط:
    // const users = await User.find({ role: "patient" })
    const users = await User.find({})
      .select("name phoneNumber role createdAt") // id بيكون _id تلقائيًا
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch patients", error: err.message });
  }
};

// PUT /api/users/:id
export const updateUser = async (req, res) => {
  try {
    const { name, phoneNumber, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (role !== undefined) user.role = role;

    await user.save();
    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user", error: err.message });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user", error: err.message });
  }
};

// GET /api/users/:id (تفاصيل المريض + المواعيد + العلاجات + الجلسات)
// export const getPatientDetails = async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id)
//       .select("name phoneNumber role")
//       .populate({
//         path: "Appointments",                 // virtual في User
//         select: "date time status note",
//         options: { sort: { date: 1, time: 1 } },
//         populate: [
//           {
//             path: "Treatments",               // virtual في Appointment (لازم تضيفه في السكيمة)
//             select: "serviceId totalSessions note status createdAt",
//             populate: [
//               {
//                 path: "Sessions",             // virtual في Treatment
//                 select: "date time note status",
//                 options: { sort: { date: 1, time: 1 } },
//                 model: TreatmentSession,
//               },
//               {
//                 path: "serviceId",
//                 select: "name price",
//               },
//             ],
//             model: Treatment,
//           },
//         ],
//         model: Appointment,
//       })
//       .lean();

//     if (!user) return res.status(404).json({ message: "Patient not found" });

//     res.status(200).json(user);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch patient", error: err.message });
//   }
// };
