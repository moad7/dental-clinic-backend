// export default (sequelize, DataTypes) => {
//   const Appointment = sequelize.define(
//     'Appointment',
//     {
//       id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true,
//       },
//       userId: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },
//       date: {
//         type: DataTypes.DATEONLY,
//         allowNull: false,
//       },
//       time: {
//         type: DataTypes.TIME,
//         allowNull: false,
//       },
//       status: {
//         type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
//         defaultValue: 'pending',
//       },
//       createdBy: {
//         type: DataTypes.ENUM('patient', 'secretary'),
//         allowNull: false,
//       },
//       note: {
//         type: DataTypes.TEXT,
//       },
//     },
//     {
//       tableName: 'appointments',
//       timestamps: true,
//     }
//   );

//   Appointment.associate = (models) => {
//     Appointment.belongsTo(models.User, { foreignKey: 'userId', as: 'patient' });
//     Appointment.hasMany(models.Treatment, {
//       foreignKey: 'appointmentId',
//       as: 'Treatments',
//     });
//     models.Treatment.belongsTo(Appointment, { foreignKey: 'appointmentId' });
//   };

//   return Appointment;
// };

// models/Appointment.js
import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, // HH:mm أو HH:mm:ss
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: String,
      enum: ['patient', 'secretary'],
      required: true,
      index: true,
    },
    note: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// فهارس مركبة مفيدة للاستعلامات الزمنية
AppointmentSchema.index({ date: 1, time: 1 });
AppointmentSchema.index({ userId: 1, date: 1, time: 1 });
AppointmentSchema.virtual("Treatments", {
  ref: "Treatment",
  localField: "_id",
  foreignField: "appointmentId",
});
// (اختياري) method بسيطة لحساب التعارض خارج الكنترولر
// AppointmentSchema.statics.hasConflict = async function ({
//   date,
//   time,
//   userId,
// }) {
//   if (!date || !time) return false;
//   const exists = await this.exists({
//     date,
//     time,
//     ...(userId ? { userId } : {}),
//     status: { $ne: 'cancelled' },
//   });
//   return !!exists;
// };
export default mongoose.model('Appointment', AppointmentSchema);
