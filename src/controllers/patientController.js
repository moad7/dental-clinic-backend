// src/controllers/patientController.js
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Appointment from '../../models/Appointment.js';
import Treatment from '../../models/Treatment.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import Service from '../../models/Service.js';
import mongoose from 'mongoose';
const currentUserId = (req) =>
  req.user?.userId || req.user?._id || req.user?.sub;
/**
 * GET /api/patients/me/profile
 * المريض يشوف بروفايله نفسه
 */
export const getMyPatientProfile = async (req, res) => {
  try {
    const id = currentUserId(req);
    const user = await User.findOne({ _id: id, role: 'patient' })
      .select('name phoneNumber email role avatar')
      .populate({
        path: 'patient',
        select: 'age gender allergies notes',
        model: Patient,
      })
      .lean();
    if (!user) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    user.id = user._id;
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch patient profile',
      error: err.message,
    });
  }
};
export const updateMyPatientProfile = async (req, res) => {
  try {
    const id = currentUserId(req);
    if (req.user.role !== 'patient') {
      return res
        .status(403)
        .json({ message: 'Only patients can update their profile' });
    }
    const { name, phoneNumber, email, avatar, age, gender, allergies, notes } =
      req.body;
    const user = await User.findOne({ _id: id, role: 'patient' });
    if (!user) return res.status(404).json({ message: 'Patient not found' });
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
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to update patient profile',
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
      .select('date time status note')
      .sort({ date: 1, time: 1 })
      .lean();
    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch my appointments',
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
      .populate({ path: 'serviceId', select: 'title services', model: Service })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(treatments);
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch my treatments',
      error: err.message,
    });
  }
};
// export const getAllPatients = async (req, res) => {
//   try {
//     const patients = await Patient.find()
//       .populate({
//         path: 'userId',
//         select: 'idNumber name email phoneNumber gender avatar role isActive',
//       })
//       .sort({ createdAt: -1 })
//       .lean();
//     const patientIds = patients.map((p) => p.userId?._id).filter(Boolean);
//     const treatments = await Treatment.find({
//       userId: { $in: patientIds },
//     })
//       .populate({
//         path: 'serviceGroupId',
//         select: 'title services',
//       })
//       .populate({
//         path: 'createdBy',
//         select: 'name role phoneNumber',
//       })
//       .populate({
//         path: 'Sessions',
//         populate: [
//           {
//             path: 'doctorId',
//             select: 'name phoneNumber avatar',
//           },
//           {
//             path: 'createdBy',
//             select: 'name role phoneNumber',
//           },
//         ],
//       })
//       .lean();
//     const treatmentsMap = {};
//     treatments.forEach((treatment) => {
//       const userId = treatment.userId.toString();
//       if (!treatmentsMap[userId]) {
//         treatmentsMap[userId] = [];
//       }
//       treatmentsMap[userId].push(treatment);
//     });
//     const result = patients.map((patient) => ({
//       ...patient,
//       treatments: treatmentsMap[patient.userId?._id?.toString()] || [],
//     }));
//     return res.status(200).json({
//       count: result.length,
//       patients: result,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: 'Failed to fetch patients',
//       error: error.message,
//     });
//   }
// };
export const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find()
      .populate({
        path: 'userId',
        select: 'idNumber name email phoneNumber gender avatar role isActive',
      })
      .sort({ createdAt: -1 })
      .lean();
    const patientIds = patients.map((p) => p.userId?._id).filter(Boolean);
    const treatments = await Treatment.find({
      userId: { $in: patientIds },
    })
      .populate({
        path: 'serviceGroupId',
        select: 'title services',
      })
      .populate({
        path: 'createdBy',
        select: 'name role phoneNumber',
      })
      .populate({
        path: 'Sessions',
        populate: [
          {
            path: 'doctorId',
            select: 'name phoneNumber avatar',
          },
          {
            path: 'createdBy',
            select: 'name role phoneNumber',
          },
        ],
      })
      .lean();
    const treatmentsMap = {};
    const lastVisitMap = {};
    treatments.forEach((treatment) => {
      const userId = treatment.userId.toString();
      // تجميع العلاجات حسب المريض
      if (!treatmentsMap[userId]) {
        treatmentsMap[userId] = [];
      }
      treatmentsMap[userId].push(treatment);
      // البحث عن آخر جلسة مكتملة
      for (const session of treatment.Sessions || []) {
        if (session.status !== 'completed') continue;
        if (!session.date) continue;
        const sessionDate = new Date(session.date);
        if (Number.isNaN(sessionDate.getTime())) continue;
        if (!lastVisitMap[userId] || sessionDate > lastVisitMap[userId]) {
          lastVisitMap[userId] = sessionDate;
        }
      }
    });
    const result = patients.map((patient) => {
      const userId = patient.userId?._id?.toString();
      return {
        ...patient,
        lastVisit: lastVisitMap[userId] || null,
        treatments: treatmentsMap[userId] || [],
      };
    });
    return res.status(200).json({
      count: result.length,
      patients: result,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch patients',
      error: error.message,
    });
  }
};
export const getPatientFullProfile = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient id',
      });
    }
    const user = await User.findOne({
      _id: patientId,
      role: 'patient',
    })
      .select(
        'idNumber name email phoneNumber gender birth avatar role isActive mustSetPassword createdAt updatedAt',
      )
      .lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Patient user not found',
      });
    }
    const patientProfile = await Patient.findOne({ userId: patientId })
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const treatments = await Treatment.find({ userId: patientId })
      .sort({ createdAt: -1 })
      .populate('serviceGroupId', 'title services')
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const treatmentIds = treatments.map((t) => t._id);
    const sessions = await TreatmentSession.find({
      treatmentId: { $in: treatmentIds },
    })
      .sort({ date: -1, time: -1 })
      .populate('doctorId', 'name phoneNumber role avatar doctor.clinic')
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const sessionsByTreatmentId = sessions.reduce((acc, session) => {
      const key = session.treatmentId.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    }, {});
    const formattedTreatments = treatments.map((treatment) => {
      const serviceGroup = treatment.serviceGroupId;
      const serviceItem =
        serviceGroup?.services?.find(
          (item) => item._id.toString() === treatment.serviceItemId.toString(),
        ) || null;
      const treatmentSessions =
        sessionsByTreatmentId[treatment._id.toString()] || [];
      const completedSessions = treatmentSessions.filter(
        (s) => s.status === 'completed',
      ).length;
      return {
        _id: treatment._id,
        status: treatment.status,
        totalSessions: treatment.totalSessions,
        completedSessions,
        remainingSessions: Math.max(
          treatment.totalSessions - completedSessions,
          0,
        ),
        note: treatment.note || '',
        createdAt: treatment.createdAt,
        updatedAt: treatment.updatedAt,
        completedAt: treatment.completedAt || null,
        createdByRole: treatment.createdByRole,
        createdBy: treatment.createdBy,
        service: {
          groupId: serviceGroup?._id || null,
          groupTitle: serviceGroup?.title || '',
          itemId: serviceItem?._id || treatment.serviceItemId,
          itemName: serviceItem?.name || '',
          description: serviceItem?.description || '',
          price: serviceItem?.price || 0,
          durationMin: serviceItem?.durationMin || null,
          photo: serviceItem?.photo || '',
        },
        sessions: treatmentSessions.map((session) => ({
          _id: session._id,
          date: session.date,
          time: session.time,
          status: session.status,
          note: session.note || '',
          doctor: session.doctorId,
          createdBy: session.createdBy,
          createdByRole: session.createdByRole,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        })),
      };
    });
    const activeTreatments = formattedTreatments.filter((t) =>
      ['in_progress', 'confirmed', 'pending'].includes(t.status),
    );
    const previousTreatments = formattedTreatments.filter((t) =>
      ['completed', 'cancelled', 'rejected'].includes(t.status),
    );
    const { userId, __v, ...cleanPatientProfile } = patientProfile;
    return res.status(200).json({
      success: true,
      user,
      patientProfile,
      statistics: {
        totalTreatments: formattedTreatments.length,
        activeTreatments: activeTreatments.length,
        previousTreatments: previousTreatments.length,
        completedTreatments: formattedTreatments.filter(
          (t) => t.status === 'completed',
        ).length,
        cancelledTreatments: formattedTreatments.filter(
          (t) => t.status === 'cancelled',
        ).length,
        rejectedTreatments: formattedTreatments.filter(
          (t) => t.status === 'rejected',
        ).length,
        totalSessions: sessions.length,
        completedSessions: sessions.filter((s) => s.status === 'completed')
          .length,
        pendingSessions: sessions.filter((s) => s.status === 'pending').length,
        confirmedSessions: sessions.filter((s) => s.status === 'confirmed')
          .length,
      },
      treatments: {
        active: activeTreatments,
        previous: previousTreatments,
      },
    });
  } catch (error) {
    console.error('getPatientFullProfileForSecretary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get patient full profile',
      error: error.message,
    });
  }
};
