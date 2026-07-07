import crypto from 'crypto';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Treatment from '../../models/Treatment.js';
import {
  getDateOnlyRange,
  getWeekdayName,
  isValidTime,
} from '../utils/fuctions.js';
import mongoose from 'mongoose';
import TreatmentSession from '../../models/TreatmentSession.js';

export const createDoctorBySecretary = async (req, res) => {
  try {
    const { formData } = req.body;

    const {
      name,
      phoneNumber,
      email,
      gender,
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

    if (phoneExists || emailExists) {
      return res.status(400).json({
        message: 'User with this phone number or email already exists',
      });
    }

    const createdDoctor = await User.create({
      name,
      phoneNumber,
      email,
      gender,
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
      role: 'patient',
      isActive: false,
      mustSetPassword: true,
      activationToken,
      activationTokenExpires: Date.now() + 1000 * 60 * 60 * 24,
    });

    const patient = await Patient.create({
      userId: user._id,
      createdBy: req.user.userId,
      birth: birth ? new Date(birth) : undefined,
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

export const getPatientFullDetailsBySecretary = async (req, res) => {
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
      .select('-password -tokens -activationToken -activationTokenExpires')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    const patientProfile = await Patient.findOne({
      userId: patientId,
    })
      .populate('createdBy', 'name role phoneNumber email')
      .lean();

    const treatments = await Treatment.find({
      userId: patientId,
    })
      .populate('serviceGroupId', 'name serviceName title items')
      .populate('createdBy', 'name role phoneNumber email')
      .populate({
        path: 'Sessions',
        populate: {
          path: 'doctorId',
          select: 'name phoneNumber email avatar',
        },
      })
      .sort({ createdAt: -1 });

    const activeTreatments = treatments.filter((t) =>
      ['in_progress', 'confirmed'].includes(t.status),
    );

    const previousTreatments = treatments.filter((t) =>
      ['completed', 'cancelled', 'rejected'].includes(t.status),
    );

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        idNumber: user.idNumber,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        avatar: user.avatar,
        role: user.role,
        isActive: user.isActive,
        mustSetPassword: user.mustSetPassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },

      patientProfile: patientProfile
        ? {
            _id: patientProfile._id,
            birth: patientProfile.birth,
            city: patientProfile.city,
            allergies: patientProfile.allergies,
            notes: patientProfile.notes,
            createdBy: patientProfile.createdBy,
            createdAt: patientProfile.createdAt,
            updatedAt: patientProfile.updatedAt,
          }
        : null,

      statistics: {
        totalTreatments: treatments.length,
        activeTreatments: activeTreatments.length,
        previousTreatments: previousTreatments.length,
        completedTreatments: treatments.filter((t) => t.status === 'completed')
          .length,
        cancelledTreatments: treatments.filter((t) => t.status === 'cancelled')
          .length,
        rejectedTreatments: treatments.filter((t) => t.status === 'rejected')
          .length,
      },

      treatments: {
        active: activeTreatments,
        previous: previousTreatments,
        all: treatments,
      },
    });
  } catch (error) {
    console.error('getPatientFullDetailsBySecretary error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get patient full details',
      error: error.message,
    });
  }
};
