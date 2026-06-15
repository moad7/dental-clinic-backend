import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import serviceRoutes from './src/routes/serviceRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import treatmentSessionRoutes from './src/routes/treatmentSessionRoutes.js';
import treatmentRoutes from './src/routes/treatmentRoutes.js';
import appointmentRoutes from './src/routes/appointmentRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import patientRoutes from './src/routes/patientRoutes.js';
import patientAdminRoutes from './src/routes/patientAdminRoutes.js';
import secretaryRoutes from './src/routes/secretaryRoutes.js';
import clinicRoutes from './src/routes/clinicRoutes.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/secretary', secretaryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sessions', treatmentSessionRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/admin/patients', patientAdminRoutes);
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'dentalclinic',
    });
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Mongo connection failed:', err.message);
    process.exit(1);
  }
})();
