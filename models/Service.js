// models/Service.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const ServiceItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, min: 0, default: 0 },
    durationMin: { type: Number, min: 5 },
    active: { type: Boolean, default: true },
    photo: { type: String },
  },
  { _id: true },
);

const ServiceGroupSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    services: { type: [ServiceItemSchema], default: [] },
  },
  { timestamps: true },
);

ServiceGroupSchema.path('services').validate(function (arr) {
  if (!Array.isArray(arr)) return true;

  const names = arr
    .map((s) => (s.name || '').trim().toLowerCase())
    .filter(Boolean);

  return names.length === new Set(names).size;
}, 'Duplicate service name inside this group');

export default model('Service', ServiceGroupSchema);
