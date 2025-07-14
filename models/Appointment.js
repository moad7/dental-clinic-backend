export default (sequelize, DataTypes) => {
  const Appointment = sequelize.define(
    'Appointment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
        defaultValue: 'pending',
      },
      createdBy: {
        type: DataTypes.ENUM('patient', 'secretary'),
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
      },
    },
    {
      tableName: 'appointments',
      timestamps: true,
    }
  );

  Appointment.associate = (models) => {
    Appointment.belongsTo(models.User, { foreignKey: 'userId', as: 'patient' });
    Appointment.hasMany(models.Treatment, {
      foreignKey: 'appointmentId',
      as: 'Treatments',
    });
    models.Treatment.belongsTo(Appointment, { foreignKey: 'appointmentId' });
  };

  return Appointment;
};
