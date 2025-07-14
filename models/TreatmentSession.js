export default (sequelize, DataTypes) => {
  const TreatmentSession = sequelize.define(
    'TreatmentSession',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      treatmentId: {
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
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'treatment_sessions',
      timestamps: true,
    }
  );

  TreatmentSession.associate = (models) => {
    TreatmentSession.belongsTo(models.Treatment, {
      foreignKey: 'treatmentId',
      onDelete: 'CASCADE',
    });
  };

  return TreatmentSession;
};
