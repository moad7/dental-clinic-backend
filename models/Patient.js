import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    age: { type: Number },
    city: { type: String },
    gender: { type: String, enum: ['male', 'female'] },
    allergies: { type: String },
    notes: { type: String },
  },
  { timestamps: true } //createdAt and updatedAt
);

export default mongoose.model('Patient', PatientSchema);
