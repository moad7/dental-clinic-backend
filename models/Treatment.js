// models/Treatment.js
import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const TreatmentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true }, // patient
    serviceGroupId: {
      type: Types.ObjectId,
      ref: 'Service',
      required: true,
    },

    serviceItemId: {
      type: Types.ObjectId,
      required: true,
    },

    totalSessions: { type: Number, required: true, min: 1 },
    note: { type: String },

    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled', 'rejected'],
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

    completedAt: { type: Date },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

TreatmentSchema.index({ userId: 1, status: 1, createdAt: -1 });
TreatmentSchema.index({ serviceGroupId: 1, createdAt: -1 });
TreatmentSchema.index({ serviceItemId: 1, createdAt: -1 });

TreatmentSchema.virtual('Sessions', {
  ref: 'TreatmentSession',
  localField: '_id',
  foreignField: 'treatmentId',
  options: { sort: { date: -1 } },
});
TreatmentSchema.methods.markCompleted = async function () {
  this.status = 'completed';
  this.completedAt = new Date();
  await this.save();
  return this;
};

export default model('Treatment', TreatmentSchema);
