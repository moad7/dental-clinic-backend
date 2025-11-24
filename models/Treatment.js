// models/Treatment.js
import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const TreatmentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true }, // patient
    serviceId: {
      type: Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },

    totalSessions: { type: Number, required: true, min: 1 },
    note: { type: String },

    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled'],
      default: 'in_progress',
      index: true,
    },

    // اختياري:
    completedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// فهارس مفيدة
TreatmentSchema.index({ userId: 1, status: 1, createdAt: -1 });
TreatmentSchema.index({ serviceId: 1, createdAt: -1 });

// Virtual populate للجلسات (بديل hasMany)
TreatmentSchema.virtual('Sessions', {
  ref: 'TreatmentSession',
  localField: '_id',
  foreignField: 'treatmentId',
  options: { sort: { sessionDate: -1 } },
});

// (اختياري) ميثود لتعليم العلاج كمكتمل
TreatmentSchema.methods.markCompleted = async function () {
  this.status = 'completed';
  this.completedAt = new Date();
  await this.save();
  return this;
};

export default model('Treatment', TreatmentSchema);
