export default (sequelize, DataTypes) => {
  const Service = sequelize.define(
    'Service',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    {
      tableName: 'services',
      timestamps: true,
    }
  );
  Service.associate = (models) => {
    Service.hasMany(models.Treatment, { foreignKey: 'serviceId' });
  };
  return Service;
};
