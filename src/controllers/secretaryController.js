import crypto from 'crypto';
import User from '../../models/User.js';

// export const createDoctorBySecretary = async (req, res) => {
//   try {
//     const { formData } = req.body;

//     const {
//       name,
//       phoneNumber,
//       email,
//       gender,
//       avatar,
//       doctor: doctorData,
//     } = formData;

//     const {
//       servicesGroupIds = [],
//       yearsOfExperience,
//       bio,
//       clinic,
//       workingHours,
//     } = doctorData || {};

//     const activationToken = crypto.randomBytes(32).toString('hex');

//     const phoneExists = await User.findOne({ phoneNumber }).lean();
//     const emailExists = await User.findOne({ email }).lean();

//     if (phoneExists || emailExists) {
//       return res.status(400).json({
//         message: 'User with this phone number or email already exists',
//       });
//     }

//     const createdDoctor = await User.create({
//       name,
//       phoneNumber,
//       email,
//       gender,
//       avatar,
//       role: 'doctor',
//       isActive: false,
//       mustSetPassword: true,
//       activationToken,
//       activationTokenExpires: Date.now() + 1000 * 60 * 60 * 24,

//       doctor: {
//         services: Array.isArray(servicesGroupIds)
//           ? servicesGroupIds.map((id) => ({ groupId: id }))
//           : [],
//         yearsOfExperience,
//         bio,
//         clinic,
//         workingHours,
//       },
//     });

//     const setPasswordLink = `${process.env.FRONTEND_URL}/set-password/${activationToken}`;

//     res.status(201).json({
//       message: 'Doctor created successfully',
//       doctor: createdDoctor,
//       setPasswordLink,
//     });
//   } catch (err) {
//     console.error('createDoctorBySecretary error:', err);
//     res.status(500).json({
//       message: 'Failed to create doctor',
//       error: err.message,
//     });
//   }
// };
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
