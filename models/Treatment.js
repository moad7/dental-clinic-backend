export default (sequelize, DataTypes) => {
  const Treatment = sequelize.define(
    'Treatment',
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
      serviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      totalSessions: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('in_progress', 'completed', 'cancelled'),
        defaultValue: 'in_progress',
      },
    },
    {
      tableName: 'treatments',
      timestamps: true,
    }
  );

  Treatment.associate = (models) => {
    Treatment.belongsTo(models.User, { foreignKey: 'userId', as: 'patient' });
    Treatment.belongsTo(models.Service, { foreignKey: 'serviceId' });

    Treatment.belongsTo(models.Appointment, {
      foreignKey: 'appointmentId',
    });

    Treatment.hasMany(models.TreatmentSession, {
      foreignKey: 'treatmentId',
      as: 'Sessions',
    });
  };

  return Treatment;
};
