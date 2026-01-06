import bcrypt from 'bcrypt';
import { generateToken } from '../utils/generateToken.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import OTP from '../../models/Otp.js';
import SmsService from '../services/smsService.js';
import jwt from 'jsonwebtoken';

function currentUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.sub;
}

// POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { name, phoneNumber, password, email } = req.body;

    if (!name || !phoneNumber || !password) {
      return res
        .status(400)
        .json({ message: 'name, phoneNumber and password are required' });
    }

    const phoneExists = await User.findOne({ phoneNumber }).lean();
    if (phoneExists) {
      return res
        .status(400)
        .json({ message: 'User with this phone number already exists' });
    }

    if (email) {
      const emailExists = await User.findOne({ email }).lean();
      if (emailExists) {
        return res
          .status(400)
          .json({ message: 'User with this email already exists' });
      }
    }

    const userData = {
      name,
      phoneNumber,
      password: password,
      role: 'patient',
    };

    if (email) {
      userData.email = email;
    }

    const user = await User.create(userData);

    await Patient.create({
      userId: user._id,
      age: null,
      gender: undefined,
      allergies: '',
      notes: '',
      avatar: '',
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: 'Registration failed', error: err.message });
  }
};

// POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res
        .status(400)
        .json({ message: 'phoneNumber and password are required' });
    }

    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const token = generateToken(user._id, user.role);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// /////////////// Generate OTP with cerdentials ///////////////
export const otpByCredentials = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res
        .status(400)
        .json({ message: 'phoneNumber and password are required' });
    }

    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000);
    const otpCodeStr = otpCode.toString();

    const codeHash = await bcrypt.hash(otpCodeStr, 10);

    const otpDoc = await OTP.create({
      phoneNumber,
      codeHash,
      type: 'Sign in',
    });

    // await SmsService.sendOTP({
    //   to: phoneNumber,
    //   code: otpCodeStr,
    //   minutesValid: 5,
    // });
    console.log(otpCodeStr);

    return res.status(200).json({
      message: 'OTP sent successfully',
      otpId: otpDoc._id,
      type: 'Sign in',
    });
  } catch (err) {
    return res.status(err?.status || 500).json({
      message: err?.message || 'Server error',
      code: err?.code,
      moreInfo: err?.moreInfo,
    });
  }
};
export const findWithOTP = async (req, res) => {
  try {
    const { otpId, otp } = req.body;
    if (!otpId || !otp) {
      return res.status(400).json({ message: 'otpId and otp are required' });
    }
    const otpDoc = await OTP.findById(otpId);
    if (!otpDoc) {
      return res
        .status(400)
        .json({ message: 'OTP is expired or already used' });
    }
    const isValidOtp = await bcrypt.compare(otp.toString(), otpDoc.codeHash);
    if (!isValidOtp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    const user = await User.findOne({
      phoneNumber: otpDoc.phoneNumber,
    });
    if (!user) {
      return res.status(400).json({ message: 'User Not Found' });
    }
    // مثال: لو حاب تضيف lastSignIn في السكيمة مستقبلاً
    // user.lastSignIn = new Date();
    await user.save();

    await OTP.findByIdAndDelete(otpId);

    const token = generateToken(user._id, user.role);

    return res.json({ user, token });
  } catch (err) {
    console.error('findWithOTP error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const otpByPhone = async (req, res) => {
  try {
    const { phoneNumber, type } = req.body;

    if (!type) {
      return res.status(400).json({ message: 'OTP type is required' });
    }
    if (!['Password recovery', 'Verify Sign Up', 'Sign in'].includes(type)) {
      return res.status(400).json({ message: 'Invalid OTP type' });
    }
    const user = await User.findOne({ phoneNumber });
    if (type === 'Password recovery' && !user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (type === 'Verify Sign Up' && user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const otpCodeStr = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otpCodeStr, 10);

    const newOtp = await OTP.create({
      phoneNumber,
      codeHash,
      type,
    });

    // await SmsService.sendOTP({
    //   to: phoneNumber,
    //   code: otpCodeStr,
    //   minutesValid: 5,
    // });
    console.log(otpCodeStr);

    return res.status(200).json({
      message: 'OTP sent successfully',
      otpId: newOtp._id,
      type,
    });
  } catch (error) {
    console.error('otp send error:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({ message: 'otpId and otp are required' });
    }

    const otpDoc = await OTP.findById(otpId);
    if (!otpDoc) {
      return res
        .status(400)
        .json({ message: 'OTP is expired or already used' });
    }

    const isValidOtp = await bcrypt.compare(otp.toString(), otpDoc.codeHash);
    if (!isValidOtp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const { phoneNumber, type } = otpDoc;

    if (type === 'Password recovery') {
      const user = await User.findOne({ phoneNumber });

      if (!user) {
        return res.status(400).json({ message: 'User Not Found' });
      }

      await OTP.findByIdAndDelete(otpId);

      return res.status(200).json({
        success: true,
        flow: 'password-recovery',
        message: 'OTP verified for password recovery',
        userId: user._id,
        phoneNumber,
      });
    }

    if (type === 'Verify Sign Up') {
      const existingUser = await User.findOne({ phoneNumber });

      if (existingUser) {
        return res
          .status(400)
          .json({ message: 'User already exists with this phone number' });
      }

      await OTP.findByIdAndDelete(otpId);

      return res.status(200).json({
        success: true,
        flow: 'verify-signup',
        message: 'OTP verified for sign up',
        phoneNumber,
      });
    }

    await OTP.findByIdAndDelete(otpId);
    return res.status(400).json({ message: 'Invalid OTP type', type });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const id = currentUserId(req);
    if (!id) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(id).select(' _id name phoneNumber role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch profile', error: err.message });
  }
};

export const modifyPassword = async (req, res) => {
  const { phoneNumber, newPassword } = req.body;

  try {
    // Find the user
    const user = await User.findOne({ phoneNumber });

    // Check if exists

    if (!user) {
      return res.status(400).json({ message: 'User Not Found' });
    }
    // Update the password
    user.password = newPassword;

    // Save the user (this triggers the `pre('save')` middleware to hash the password)
    await user.save();
    res.status(200).json({ message: 'Password Updated' });
  } catch (error) {
    res.status(error.statusCode || 400).send({ message: error.message });
  }
};

export const resendOtpCode = async (req, res) => {};
