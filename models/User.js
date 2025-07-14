export default (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('doctor', 'secretary', 'patient'),
        allowNull: false,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
    }
  );
  User.associate = (models) => {
    User.hasOne(models.Patient, { foreignKey: 'userId', as: 'patient' });
    User.hasMany(models.Treatment, { foreignKey: 'userId', as: 'treatments' });
    User.hasMany(models.Appointment, {
      foreignKey: 'userId',
      as: 'Appointments',
    });
  };
  return User;
};
