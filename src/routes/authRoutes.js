import express from 'express';
import {
  registerUser,
  getProfile,
  otpByCredentials,
  findWithOTP,
  otpByPhone,
  verifyOtp,
  modifyPassword,
  setPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/otp', otpByCredentials);
router.post('/otp/otpsend', otpByPhone);

router.post('/signinwithotp', findWithOTP);

router.get('/profile', protect, getProfile);
router.post('/verifyOtp', verifyOtp);
router.put('/resetpassword', modifyPassword);
router.post('/setpassword/:token', setPassword);
// router.put('/profile', protect, updateProfile);

export default router;
