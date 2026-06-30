// models/TreatmentSession.js
import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const TreatmentSessionSchema = new Schema(
  {
    treatmentId: {
      type: Types.ObjectId,
      ref: 'Treatment',
      required: true,
      index: true,
    },

    doctorId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByRole: {
      type: String,
      enum: ['secretary', 'doctor', 'patient'],
      required: true,
    },
    note: { type: String },
  },
  { timestamps: true },
);

TreatmentSessionSchema.index({
  doctorId: 1,
  date: 1,
  time: 1,
  status: 1,
});

TreatmentSessionSchema.index({
  treatmentId: 1,
  date: 1,
  time: 1,
});

TreatmentSessionSchema.statics.hasConflict = async function ({
  doctorId,
  date,
  time,
}) {
  if (!doctorId || !date || !time) return false;

  const exists = await this.exists({
    doctorId,
    date,
    time,
    status: { $in: ['pending', 'confirmed'] },
  });

  return !!exists;
};

export default model('TreatmentSession', TreatmentSessionSchema);
