import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ClinicSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    phones: [{ type: String, trim: true }],
    geo: {
      lat: Number,
      lng: Number,
    },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

export default model('Clinic', ClinicSchema);
