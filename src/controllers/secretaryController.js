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

const CONFLICT_STATUSES = ['pending', 'confirmed'];

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

    const patientIds = patients.map((p) => p.userId?._id);

    const treatments = await Treatment.find({
      userId: { $in: patientIds },
    })
      .populate({
        path: 'serviceId',
        select: 'title',
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
    console.error(error);

    return res.status(500).json({
      message: 'Failed to fetch patients',
      error: error.message,
    });
  }
};

// POST /api/secretary/availableDoctors
export const getAvailableDoctors = async (req, res) => {
  try {
    const { payload } = req.body;
    const { serviceGroupId, date, time } = payload;
    if (!serviceGroupId || !date || !time) {
      return res.status(400).json({
        message: 'serviceGroupId, date and time are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceGroupId)) {
      return res.status(400).json({
        message: 'Invalid serviceGroupId',
      });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({
        message: 'Invalid time format. Expected HH:mm',
      });
    }

    const weekday = getWeekdayName(date);
    const dateRange = getDateOnlyRange(date);

    if (!weekday || !dateRange) {
      return res.status(400).json({
        message: 'Invalid date',
      });
    }

    const serviceObjectId = new mongoose.Types.ObjectId(serviceGroupId);

    const matchedDoctors = await User.find({
      role: 'doctor',
      isActive: true,
      'doctor.services.groupId': serviceObjectId,
      doctor: {
        $exists: true,
      },
      'doctor.workingHours': {
        $elemMatch: {
          day: weekday,
          isClosed: false,
          start: { $lte: time },
          end: { $gte: time },
        },
      },
    })
      .select('-password -tokens -activationToken -activationTokenExpires')
      .populate({
        path: 'doctor.services.groupId',
        select: 'title services',
      })
      .populate({
        path: 'doctor.clinic',
        select: 'name address phones',
      })
      .lean();

    if (matchedDoctors.length === 0) {
      return res.status(200).json({
        count: 0,
        doctors: [],
      });
    }

    const doctorIds = matchedDoctors.map((doctor) => doctor._id);

    const conflicts = await TreatmentSession.find({
      doctorId: { $in: doctorIds },
      status: { $in: CONFLICT_STATUSES },
      time,
      date: {
        $gte: dateRange.start,
        $lt: dateRange.end,
      },
    })
      .select('doctorId')
      .lean();

    const conflictedDoctorIds = new Set(
      conflicts.map((session) => session.doctorId.toString()),
    );

    const availableDoctors = matchedDoctors.filter(
      (doctor) => !conflictedDoctorIds.has(doctor._id.toString()),
    );

    return res.status(200).json({
      count: availableDoctors.length,
      doctors: availableDoctors,
    });
  } catch (error) {
    console.error('getAvailableDoctors error:', error);

    return res.status(500).json({
      message: 'Failed to get available doctors',
      error: error.message,
    });
  }
};
