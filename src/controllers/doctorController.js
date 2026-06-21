import bcrypt from 'bcrypt';
import User from '../../models/User.js';

// GET /api/doctor/getAllDoctors
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-password -tokens -activationToken')
      .populate({
        path: 'doctor.services.groupId',
        select: 'title services',
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error('getAllDoctors error:', error);

    return res.status(500).json({
      message: 'Failed to fetch doctors',
      error: error.message,
    });
  }
};
