import mongoose from 'mongoose';
const { Schema, model } = mongoose;
import bcrypt from 'bcrypt';

/* ----------------------------------------------
   Doctor Profile
------------------------------------------------*/
const DoctorProfileSchema = new Schema(
  {
    services: [
      {
        groupId: {
          type: Schema.Types.ObjectId,
          ref: 'Service',
          required: true,
        },
        serviceId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
    // licenseNumber: { type: String, trim: true },
    yearsOfExperience: { type: Number, min: 0 },
    bio: { type: String, trim: true },
    clinic: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
    workingHours: [
      {
        day: {
          type: String,
          enum: [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
          ],
          required: true,
        },

        isClosed: {
          type: Boolean,
          default: false,
        },

        start: {
          type: String,
          required: function () {
            return !this.isClosed;
          },
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },

        end: {
          type: String,
          required: function () {
            return !this.isClosed;
          },
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
      },
    ],
    bio: String,
  },
  { _id: false },
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
  { _id: false },
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
    password: { type: String, required: false },
    role: {
      type: String,
      enum: ['doctor', 'secretary', 'patient'],
      required: true,
    },
    phoneNumber: { type: String, required: true },
    gender: {
      type: String,
      enum: ['male', 'female'],
      // required: true
    },
    avatar: { type: String },
    isActive: {
      type: Boolean,
      default: false,
    },
    mustSetPassword: {
      type: Boolean,
      default: true,
    },
    activationToken: {
      type: String,
    },
    activationTokenExpires: {
      type: Date,
    },
    tokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    doctor: { type: DoctorProfileSchema, default: undefined },
    secretary: { type: SecretaryProfileSchema, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
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
        new Error('Secretary workShift is required for secretary role.'),
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
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
export default model('User', UserSchema);
