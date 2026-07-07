import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    birth: { type: Date },
    city: { type: String },
    allergies: { type: String },
    notes: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }, //createdAt and updatedAt
);

export default mongoose.model('Patient', PatientSchema);
