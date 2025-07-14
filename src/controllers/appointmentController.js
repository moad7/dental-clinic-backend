import { Op } from 'sequelize';

export const createAppointment = async (req, res) => {
  const { userId, date, time, note } = req.body;

  const createdBy = req.user.role === 'secretary' ? 'secretary' : 'patient';
  const patientId = createdBy === 'secretary' ? userId : req.user.userId;
  if (!patientId) {
    return res.status(400).json({ message: 'Patient ID is required' });
  }
  if (!date || !time) {
    return res.status(400).json({ message: 'Date and time are required' });
  }

  try {
    const appointment = await req.db.Appointment.create({
      userId: patientId,
      date,
      time,
      note,
      createdBy,
    });

    res
      .status(201)
      .json({ message: 'Appointment created successfully', appointment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create appointment', error: err.message });
  }
};

export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { date, time, note, status } = req.body;

  try {
    const appointment = await req.db.Appointment.findByPk(id);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    const isPatient =
      req.user.role === 'patient' && req.user.userId === appointment.userId;
    const isSecretary = req.user.role === 'secretary';

    if (!isPatient && !isSecretary) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to update this appointment' });
    }

    if (date !== undefined) appointment.date = date;
    if (time !== undefined) appointment.time = time;
    if (note !== undefined) appointment.note = note;
    if (status !== undefined) appointment.status = status;

    await appointment.save();
    res
      .status(200)
      .json({ message: 'Appointment updated successfully', appointment });
  } catch (err) {
    console.error(err);

    res
      .status(500)
      .json({ message: 'Failed to update appointment', error: err.message });
  }
};

export const deleteAppointment = async (req, res) => {
  const { id } = req.params;

  try {
    const appointment = await req.db.Appointment.findByPk(id);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    const isPatient =
      req.user.role === 'patient' && req.user.userId === appointment.userId;
    const isSecretary = req.user.role === 'secretary';

    if (!isPatient && !isSecretary) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to delete this appointment' });
    }

    await appointment.destroy();
    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete appointment', error: err.message });
  }
};

export const getAllAppointments = async (req, res) => {
  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    const appointments = await req.db.Appointment.findAll({
      include: [
        {
          model: req.db.User,
          as: 'patient',
          attributes: ['id', 'name', 'phoneNumber'],
        },
      ],
      order: [
        ['date', 'ASC'],
        ['time', 'ASC'],
      ],
    });

    res.status(200).json(appointments);
  } catch (err) {
    console.error(err);

    res
      .status(500)
      .json({ message: 'Failed to fetch appointments', error: err.message });
  }
};

export const getMyAppointments = async (req, res) => {
  try {
    const appointments = await req.db.Appointment.findAll({
      where: { userId: req.user.userId },
      order: [
        ['date', 'ASC'],
        ['time', 'ASC'],
      ],
    });

    res.status(200).json(appointments);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch appointments', error: err.message });
  }
};
export const getTodayAppointments = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const appointments = await req.db.Appointment.findAll({
      where: {
        date: today,
        status: { [Op.ne]: 'cancelled' },
      },
      include: [
        {
          model: req.db.User,
          as: 'patient',
          attributes: ['name'],
        },
      ],
      order: [['time', 'ASC']],
    });

    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch today's appointments",
      error: err.message,
    });
  }
};

export const checkAvailability = async (req, res) => {
  const { date, time } = req.query;

  if (!date || !time) {
    return res.status(400).json({ message: 'Date and time are required' });
  }

  try {
    const exists = await req.db.Appointment.findOne({
      where: { date, time },
    });

    if (exists) {
      return res.status(200).json({ available: false });
    }

    return res.status(200).json({ available: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error checking availability' });
  }
};
