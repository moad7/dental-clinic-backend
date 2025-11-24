import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const OtpSchema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true,
  },
  codeHash: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['Sign in', 'Password recovery', 'Verify Sign Up'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

OtpSchema.methods.toJSON = function () {
  const otp = this.toObject();
  delete otp.codeHash;
  delete otp.createdAt;
  return otp;
};

OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

export default model('Otp', OtpSchema);
