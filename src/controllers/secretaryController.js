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
        select: 'name email phoneNumber gender avatar role isActive',
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
