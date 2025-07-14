import mysql from 'mysql2/promise';
import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';

import UserModel from '../models/User.js';
import PatientModel from '../models/Patient.js';
import ServiceModel from '../models/Service.js';
import TreatmentModel from '../models/Treatment.js';
import TreatmentSessionModel from '../models/TreatmentSession.js';
import AppointmentModel from '../models/Appointment.js';


dotenv.config();

const { DB_NAME, DB_USER, DB_PASS, DB_HOST } = process.env;

async function createDatabaseIfNotExists() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.end();
}

const db = {};

await createDatabaseIfNotExists();

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: 'mysql',
  logging: false,
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = UserModel(sequelize, DataTypes);
db.Patient = PatientModel(sequelize, DataTypes);
db.Service = ServiceModel(sequelize, DataTypes);
db.Treatment = TreatmentModel(sequelize, DataTypes);
db.TreatmentSession = TreatmentSessionModel(sequelize, DataTypes);
db.Appointment = AppointmentModel(sequelize, DataTypes);

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

export default db;
