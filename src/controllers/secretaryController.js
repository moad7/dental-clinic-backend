import crypto from 'crypto';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Treatment from '../../models/Treatment.js';
import mongoose from 'mongoose';
import TreatmentSession from '../../models/TreatmentSession.js';
import Clinic from '../../models/Clinic.js';
import Service from '../../models/Service.js';

export const createDoctorBySecretary = async (req, res) => {
  try {
    const { formData } = req.body;

    const {
      idNumber,
      name,
      phoneNumber,
      email,
      gender,
      birth,
      avatar,
      doctor: doctorData,
    } = formData;

    const {
      servicesGroupIds = [],
      yearsOfExperience,
      bio,
      clinic,
      workingHours,
    } = doctorData || {};

    const activationToken = crypto.randomBytes(32).toString('hex');

    const phoneExists = await User.findOne({ phoneNumber }).lean();
    const emailExists = email ? await User.findOne({ email }).lean() : null;
    const idNumberExists = await User.findOne({ idNumber }).lean();
    if (phoneExists || emailExists || idNumberExists) {
      return res.status(400).json({
        message:
          'User with this id Number && phone number or email already exists',
      });
    }

    const createdDoctor = await User.create({
      idNumber,
      name,
      phoneNumber,
      email,
      gender,
      birth,
      avatar,
      role: 'doctor',
      isActive: false,
      mustSetPassword: true,
      activationToken,
      activationTokenExpires: Date.now() + 1000 * 60 * 60 * 24,

      doctor: {
        services: Array.isArray(servicesGroupIds)
          ? servicesGroupIds.map((id) => ({ groupId: id }))
          : [],
        yearsOfExperience,
        bio,
        clinic,
        workingHours,
      },
    });

    const setPasswordLink = `${process.env.FRONTEND_URL}/set-password/${activationToken}`;

    const populatedDoctor = await User.findById(createdDoctor._id)
      .populate('doctor.services.groupId')
      .populate('doctor.clinic')
      .select('-password -tokens')
      .lean();

    res.status(201).json({
      message: 'Doctor created successfully',
      doctor: populatedDoctor,
      setPasswordLink,
    });
  } catch (err) {
    console.error('createDoctorBySecretary error:', err);
    res.status(500).json({
      message: 'Failed to create doctor',
      error: err.message,
    });
  }
};
export const updateDoctorBySecretary = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { formData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID',
      });
    }

    if (!formData) {
      return res.status(400).json({
        success: false,
        message: 'Form data is required',
      });
    }

    const {
      name,
      idNumber,
      phoneNumber,
      email,
      birth,
      gender,
      isActive,
      doctor,
    } = formData;

    const existingDoctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
    });

    if (!existingDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor data is required',
      });
    }

    const duplicateIdNumber = await User.findOne({
      _id: { $ne: doctorId },
      idNumber: idNumber.trim(),
    });

    if (duplicateIdNumber) {
      return res.status(409).json({
        success: false,
        message: 'ID number already exists',
      });
    }

    const duplicatePhone = await User.findOne({
      _id: { $ne: doctorId },
      phoneNumber: phoneNumber.trim(),
    });

    if (duplicatePhone) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists',
      });
    }

    const normalizedEmail = email?.trim() || null;

    if (normalizedEmail) {
      const duplicateEmail = await User.findOne({
        _id: { $ne: doctorId },
        email: normalizedEmail,
      });

      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists',
        });
      }
    }

    if (!doctor.clinic || !mongoose.Types.ObjectId.isValid(doctor.clinic)) {
      return res.status(400).json({
        success: false,
        message: 'Valid clinic is required',
      });
    }

    const clinicExists = await Clinic.exists({
      _id: doctor.clinic,
    });

    if (!clinicExists) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const servicesGroupIds = doctor.servicesGroupIds || [];
    if (!Array.isArray(servicesGroupIds)) {
      return res.status(400).json({
        success: false,
        message: 'servicesGroupIds must be an array',
      });
    }

    const invalidServiceId = servicesGroupIds.find(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidServiceId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service group ID',
      });
    }

    const uniqueServiceGroupIds = [...new Set(servicesGroupIds.map(String))];

    if (uniqueServiceGroupIds.length > 0) {
      const servicesCount = await Service.countDocuments({
        _id: {
          $in: uniqueServiceGroupIds,
        },
      });

      if (servicesCount !== uniqueServiceGroupIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more service groups do not exist',
        });
      }
    }

    const yearsOfExperience = Number(doctor.yearsOfExperience);

    if (Number.isNaN(yearsOfExperience) || yearsOfExperience < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid years of experience',
      });
    }

    const workingHours = doctor.workingHours || [];

    if (!Array.isArray(workingHours)) {
      return res.status(400).json({
        success: false,
        message: 'Working hours must be an array',
      });
    }

    existingDoctor.name = name.trim();
    existingDoctor.idNumber = idNumber.trim();
    existingDoctor.phoneNumber = phoneNumber.trim();
    existingDoctor.email = normalizedEmail;
    existingDoctor.birth = birth || null;
    existingDoctor.gender = gender;

    if (typeof isActive === 'boolean') {
      existingDoctor.isActive = isActive;
    }

    existingDoctor.doctor = {
      services: uniqueServiceGroupIds.map((groupId) => ({
        groupId,
      })),
      yearsOfExperience,
      bio: doctor.bio?.trim() || '',
      clinic: doctor.clinic,
      workingHours,
    };

    await existingDoctor.save();

    await existingDoctor.populate([
      {
        path: 'doctor.services.groupId',
        select: 'title',
      },
      {
        path: 'doctor.clinic',
        select: 'name address',
      },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Doctor updated successfully',
      doctor: existingDoctor,
    });
  } catch (error) {
    console.error('updateDoctorBySecretary error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((err) => err.message)
          .join(', '),
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Doctor data already exists',
        field: Object.keys(error.keyPattern || {})[0],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update doctor',
      error: error.message,
    });
  }
};

export const getAllPatientBySecretary = async (req, res) => {
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

    treatments.forEach((treatment) => {
      const userId = treatment.userId.toString();

      if (!treatmentsMap[userId]) {
        treatmentsMap[userId] = [];
      }

      treatmentsMap[userId].push(treatment);
    });

    const result = patients.map((patient) => ({
      ...patient,
      treatments: treatmentsMap[patient.userId?._id?.toString()] || [],
    }));

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

export const createPatientBySecretary = async (req, res) => {
  try {
    const { payload } = req.body;
    const {
      idNumber,
      name,
      phoneNumber,
      email,
      gender,
      birth,
      city,
      allergies,
      notes,
    } = payload;
    console.log(payload);

    if (!name || !phoneNumber || !idNumber) {
      return res.status(400).json({
        message: 'name and phoneNumber , idNumber are required',
      });
    }

    const idNumberExists = await User.findOne({ idNumber });
    if (idNumberExists) {
      return res.status(400).json({
        message: 'Id number already exists',
      });
    }

    const phoneExists = await User.findOne({ phoneNumber });
    if (phoneExists) {
      return res.status(400).json({
        message: 'Phone number already exists',
      });
    }

    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });

      if (emailExists) {
        return res.status(400).json({
          message: 'Email already exists',
        });
      }
    }

    const activationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      idNumber,
      name,
      phoneNumber,
      email,
      gender,
      birth: birth ? new Date(birth) : undefined,
      role: 'patient',
      isActive: false,
      mustSetPassword: true,
      activationToken,
      activationTokenExpires: Date.now() + 1000 * 60 * 60 * 24,
    });

    const patient = await Patient.create({
      userId: user._id,
      createdBy: req.user.userId,
      city,
      allergies,
      notes,
    });

    const setPasswordLink = `${process.env.FRONTEND_URL}/set-password/${activationToken}`;

    return res.status(201).json({
      message: 'Patient created successfully',
      patient,
      user: user.toJSON(),
      setPasswordLink,
    });
  } catch (error) {
    console.error('createPatientBySecretary error:', error);

    return res.status(500).json({
      message: 'Failed to create patient',
      error: error.message,
    });
  }
};

// export const getPatientFullDetailsBySecretary = async (req, res) => {
//   try {
//     const { patientId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(patientId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid patient id',
//       });
//     }

//     const user = await User.findOne({
//       _id: patientId,
//       role: 'patient',
//     })
//       .select('-password -tokens -activationToken -activationTokenExpires')
//       .lean();

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'Patient not found',
//       });
//     }

//     const patientProfile = await Patient.findOne({
//       userId: patientId,
//     })
//       .populate('createdBy', 'name role phoneNumber email')
//       .lean();

//     const treatments = await Treatment.find({
//       userId: patientId,
//     })
//       .populate('serviceGroupId', 'name serviceName title items')
//       .populate('createdBy', 'name role phoneNumber email')
//       .populate({
//         path: 'Sessions',
//         populate: {
//           path: 'doctorId',
//           select: 'name phoneNumber email avatar',
//         },
//       })
//       .sort({ createdAt: -1 });

//     const activeTreatments = treatments.filter((t) =>
//       ['in_progress', 'confirmed'].includes(t.status),
//     );

//     const previousTreatments = treatments.filter((t) =>
//       ['completed', 'cancelled', 'rejected'].includes(t.status),
//     );

//     return res.status(200).json({
//       success: true,
//       user: {
//         _id: user._id,
//         idNumber: user.idNumber,
//         name: user.name,
//         email: user.email,
//         phoneNumber: user.phoneNumber,
//         gender: user.gender,
//         avatar: user.avatar,
//         role: user.role,
//         isActive: user.isActive,
//         mustSetPassword: user.mustSetPassword,
//         createdAt: user.createdAt,
//         updatedAt: user.updatedAt,
//       },

//       patientProfile: patientProfile
//         ? {
//             _id: patientProfile._id,
//             birth: patientProfile.birth,
//             city: patientProfile.city,
//             allergies: patientProfile.allergies,
//             notes: patientProfile.notes,
//             createdBy: patientProfile.createdBy,
//             createdAt: patientProfile.createdAt,
//             updatedAt: patientProfile.updatedAt,
//           }
//         : null,

//       statistics: {
//         totalTreatments: treatments.length,
//         activeTreatments: activeTreatments.length,
//         previousTreatments: previousTreatments.length,
//         completedTreatments: treatments.filter((t) => t.status === 'completed')
//           .length,
//         cancelledTreatments: treatments.filter((t) => t.status === 'cancelled')
//           .length,
//         rejectedTreatments: treatments.filter((t) => t.status === 'rejected')
//           .length,
//       },

//       treatments: {
//         active: activeTreatments,
//         previous: previousTreatments,
//         all: treatments,
//       },
//     });
//   } catch (error) {
//     console.error('getPatientFullDetailsBySecretary error:', error);

//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get patient full details',
//       error: error.message,
//     });
//   }
// };

export const getPatientFullProfileForSecretary = async (req, res) => {
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
