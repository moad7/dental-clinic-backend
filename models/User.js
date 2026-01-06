import mongoose from 'mongoose';
const { Schema, model } = mongoose;
import bcrypt from 'bcrypt';

/* ----------------------------------------------
   Doctor Profile
------------------------------------------------*/
const ClinicSchema = new Schema(
  {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    phones: [{ type: String, trim: true }],
    geo: { lat: Number, lng: Number },
    description: { type: String, trim: true },
  },
  { _id: false }
);
const DoctorProfileSchema = new Schema(
  {
    specialty: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    licenseNumber: { type: String, trim: true },
    yearsOfExperience: { type: Number, min: 0 },
    languages: [{ type: String, trim: true }],
    clinic: ClinicSchema,
    workingHours: [
      {
        day: { type: String },
        start: String,
        end: String,
        isClosed: Boolean,
      },
    ],
    bio: String,
  },
  { _id: false }
);

/* ----------------------------------------------
   Secretary Profile
------------------------------------------------*/
const SecretaryProfileSchema = new Schema(
  {
    workShift: { type: String, enum: ['morning', 'evening', 'full'] },
    hireDate: { type: Date },
    salary: { type: Number, min: 0 },
    notes: { type: String },
  },
  { _id: false }
);

/* ----------------------------------------------
   Main User Schema
------------------------------------------------*/
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['doctor', 'secretary', 'patient'],
      required: true,
    },
    phoneNumber: { type: String, required: true },

    avatar: { type: String },

    doctor: { type: DoctorProfileSchema, default: undefined },
    secretary: { type: SecretaryProfileSchema, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.pre('save', function (next) {
  if (this.role === 'doctor') {
    this.secretary = undefined;
    if (!this.doctor || !this.doctor.specialty) {
      return next(new Error('Doctor specialty is required for doctor role.'));
    }
  }

  if (this.role === 'secretary') {
    this.doctor = undefined;
    if (!this.secretary || !this.secretary.workShift) {
      return next(
        new Error('Secretary workShift is required for secretary role.')
      );
    }
  }

  if (this.role === 'patient') {
    this.doctor = undefined;
    this.secretary = undefined;
  }

  next();
});

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
export default model('User', UserSchema);
