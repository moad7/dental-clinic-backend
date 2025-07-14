import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/db.js';
import serviceRoutes from './src/routes/serviceRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import treatmentSessionRoutes from './src/routes/treatmentSessionRoutes.js';
import treatmentRoutes from './src/routes/treatmentRoutes.js';
import appointmentRoutes from './src/routes/appointmentRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import userRoutes from './src/routes/userRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.db = db;
  next();
});
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sessions', treatmentSessionRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.POORT || 3000;

db.sequelize.sync().then(() => {
  console.log('Database connected & models synced');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
