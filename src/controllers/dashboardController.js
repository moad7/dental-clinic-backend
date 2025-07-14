import { Op } from 'sequelize';

export const getDashboardSummary = async (req, res) => {
  try {
    const [
      totalPatients,
      totalAppointments,
      upcomingAppointments,
      todayAppointments,
      activeTreatments,
      completedTreatments,
    ] = await Promise.all([
      req.db.User.count({ where: { role: 'patient' } }),

      req.db.Appointment.count(),

      req.db.Appointment.count({
        where: { date: { [Op.gt]: new Date().toISOString().split('T')[0] } },
      }),

      req.db.Appointment.count({
        where: { date: new Date().toISOString().split('T')[0] },
      }),

      req.db.Treatment.count({ where: { status: 'in_progress' } }),

      req.db.Treatment.count({ where: { status: 'completed' } }),
    ]);

    res.status(200).json({
      totalPatients,
      totalAppointments,
      upcomingAppointments,
      todayAppointments,
      activeTreatments,
      completedTreatments,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch dashboard stats', error: err.message });
  }
};
export const getUpcomingAppointmentsForCalendar = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const appointments = await req.db.Appointment.findAll({
      where: {
        date: { [Op.gte]: today },
        status: { [Op.ne]: 'cancelled' },
      },
      include: [{ model: req.db.User, as: 'patient', attributes: ['name'] }],
      order: [
        ['date', 'ASC'],
        ['time', 'ASC'],
      ],
    });

    const result = appointments.map((app) => ({
      id: app.id,
      title: app.patient.name,
      date: app.date,
      time: app.time,
    }));

    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({
        message: 'Failed to fetch calendar appointments',
        error: err.message,
      });
  }
};
