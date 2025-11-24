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
    date: { type: Date, required: true, index: true },
    time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    note: { type: String },
  },
  { timestamps: true }
);

// ⚙️ الفهارس (indexes)
TreatmentSessionSchema.index({ treatmentId: 1, date: 1, time: 1 });

// 🔗 عند حذف العلاج، نحذف جلساته (نفس onDelete: 'CASCADE')
TreatmentSessionSchema.pre('remove', async function (next) {
  try {
    // لا داعي نحذف العلاج نفسه — هذا لو حذفنا العلاج نحذف الجلسات
    // هنا نقدر نضيف كود لو احتجت cascading manual
    next();
  } catch (err) {
    next(err);
  }
});

// (اختياري) دالة للتحقق من التعارض الزمني مع جلسات أخرى لنفس العلاج
TreatmentSessionSchema.statics.hasConflict = async function ({
  treatmentId,
  date,
  time,
}) {
  if (!treatmentId || !date || !time) return false;
  const exists = await this.exists({
    treatmentId,
    date,
    time,
    status: { $in: ['pending', 'confirmed'] },
  });
  return !!exists;
};

export default model('TreatmentSession', TreatmentSessionSchema);
