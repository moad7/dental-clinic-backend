import Appointment from '../../models/Appointment.js';
import User from '../../models/User.js'; // لو تحتاج populate للبيانات

function currentUserId(req) {
  return req.user?._id;
}

// export const createAppointment = async (req, res) => {
//   const { userId, date, time, note } = req.body;

//   const createdBy = req.user.role === 'secretary' ? 'secretary' : 'patient';
//   const patientId = createdBy === 'secretary' ? userId : req.user.userId;
//   if (!patientId) {
//     return res.status(400).json({ message: 'Patient ID is required' });
//   }
//   if (!date || !time) {
//     return res.status(400).json({ message: 'Date and time are required' });
//   }

//   try {
//     const appointment = await req.db.Appointment.create({
//       userId: patientId,
//       date,
//       time,
//       note,
//       createdBy,
//     });

//     res
//       .status(201)
//       .json({ message: 'Appointment created successfully', appointment });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to create appointment', error: err.message });
//   }
// };

// POST /api/appointments
export const createAppointment = async (req, res) => {
  try {
    const { userId, date, time, note } = req.body;

    const createdBy = req.user.role === 'secretary' ? 'secretary' : 'patient';
    const patientId = createdBy === 'secretary' ? userId : currentUserId(req);

    if (!patientId)
      return res.status(400).json({ message: 'Patient ID is required' });
    if (!date || !time)
      return res.status(400).json({ message: 'Date and time are required' });

    // نخزن date عند منتصف الليل
    const d = new Date(date);
    const day = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );

    // تأكد من توفر الموعد (غير ملغي) بنفس التاريخ والوقت
    const exists = await Appointment.findOne({
      date: day,
      time,
      status: { $ne: 'cancelled' },
    }).lean();

    if (exists)
      return res.status(409).json({ message: 'Time is not available' });

    const appointment = await Appointment.create({
      userId: patientId,
      date: day,
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

// export const updateAppointment = async (req, res) => {
//   const { id } = req.params;
//   const { date, time, note, status } = req.body;

//   try {
//     const appointment = await req.db.Appointment.findByPk(id);
//     if (!appointment)
//       return res.status(404).json({ message: 'Appointment not found' });

//     const isPatient =
//       req.user.role === 'patient' && req.user.userId === appointment.userId;
//     const isSecretary = req.user.role === 'secretary';

//     if (!isPatient && !isSecretary) {
//       return res
//         .status(403)
//         .json({ message: 'Unauthorized to update this appointment' });
//     }

//     if (date !== undefined) appointment.date = date;
//     if (time !== undefined) appointment.time = time;
//     if (note !== undefined) appointment.note = note;
//     if (status !== undefined) appointment.status = status;

//     await appointment.save();
//     res
//       .status(200)
//       .json({ message: 'Appointment updated successfully', appointment });
//   } catch (err) {
//     console.error(err);

//     res
//       .status(500)
//       .json({ message: 'Failed to update appointment', error: err.message });
//   }
// };

// PUT /api/appointments/:id
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, note, status } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    const isPatient =
      req.user.role === 'patient' &&
      String(currentUserId(req)) === String(appointment.userId);
    const isSecretary = req.user.role === 'secretary';

    if (!isPatient && !isSecretary) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to update this appointment' });
    }

    if (date !== undefined) {
      const d = new Date(date);
      appointment.date = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      );
    }
    if (time !== undefined) appointment.time = time;
    if (note !== undefined) appointment.note = note;
    if (status !== undefined) appointment.status = status;

    // لو غيّرنا التاريخ/الوقت، نتأكد من التوفر
    if (
      (date !== undefined || time !== undefined) &&
      appointment.status !== 'cancelled'
    ) {
      const clash = await Appointment.findOne({
        _id: { $ne: appointment._id },
        date: appointment.date,
        time: appointment.time,
        status: { $ne: 'cancelled' },
      }).lean();
      if (clash)
        return res.status(409).json({ message: 'Time is not available' });
    }

    await appointment.save();
    res
      .status(200)
      .json({ message: 'Appointment updated successfully', appointment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update appointment', error: err.message });
  }
};

// export const deleteAppointment = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const appointment = await req.db.Appointment.findByPk(id);
//     if (!appointment)
//       return res.status(404).json({ message: 'Appointment not found' });

//     const isPatient =
//       req.user.role === 'patient' && req.user.userId === appointment.userId;
//     const isSecretary = req.user.role === 'secretary';

//     if (!isPatient && !isSecretary) {
//       return res
//         .status(403)
//         .json({ message: 'Unauthorized to delete this appointment' });
//     }

//     await appointment.destroy();
//     res.status(200).json({ message: 'Appointment deleted successfully' });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to delete appointment', error: err.message });
//   }
// };

// DELETE /api/appointments/:id
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    const isPatient =
      req.user.role === 'patient' &&
      String(currentUserId(req)) === String(appointment.userId);
    const isSecretary = req.user.role === 'secretary';

    if (!isPatient && !isSecretary) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to delete this appointment' });
    }

    await Appointment.deleteOne({ _id: id });
    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete appointment', error: err.message });
  }
};

// export const getAllAppointments = async (req, res) => {
//   if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
//     return res.status(403).json({ message: 'Unauthorized' });
//   }

//   try {
//     const appointments = await req.db.Appointment.findAll({
//       include: [
//         {
//           model: req.db.User,
//           as: 'patient',
//           attributes: ['id', 'name', 'phoneNumber'],
//         },
//       ],
//       order: [
//         ['date', 'ASC'],
//         ['time', 'ASC'],
//       ],
//     });

//     res.status(200).json(appointments);
//   } catch (err) {
//     console.error(err);

//     res
//       .status(500)
//       .json({ message: 'Failed to fetch appointments', error: err.message });
//   }
// };
// GET /api/appointments
export const getAllAppointments = async (req, res) => {
  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  try {
    const appointments = await Appointment.find({})
      .populate({ path: 'userId', select: 'name phoneNumber', model: User })
      .sort({ date: 1, time: 1 })
      .lean();

    // إعادة تسمية بسيطة لمواءمة "as: 'patient'"
    const mapped = appointments.map((a) => ({
      ...a,
      patient: a.userId, // alias
      userId: a.userId?._id || a.userId,
    }));

    res.status(200).json(mapped);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch appointments', error: err.message });
  }
};
// export const getMyAppointments = async (req, res) => {
//   try {
//     const appointments = await req.db.Appointment.findAll({
//       where: { userId: req.user.userId },
//       order: [
//         ['date', 'ASC'],
//         ['time', 'ASC'],
//       ],
//     });

//     res.status(200).json(appointments);
//   } catch (err) {
//     res
//       .status(500)
//       .json({ message: 'Failed to fetch appointments', error: err.message });
//   }
// };

// GET /api/appointments/mine
export const getMyAppointments = async (req, res) => {
  try {
    const myId = currentUserId(req);
    const appointments = await Appointment.find({ userId: myId })
      .sort({ date: 1, time: 1 })
      .lean();
    res.status(200).json(appointments);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch appointments', error: err.message });
  }
};

// export const getTodayAppointments = async (req, res) => {
//   try {
//     const today = new Date().toISOString().split('T')[0];

//     const appointments = await req.db.Appointment.findAll({
//       where: {
//         date: today,
//         status: { [Op.ne]: 'cancelled' },
//       },
//       include: [
//         {
//           model: req.db.User,
//           as: 'patient',
//           attributes: ['name'],
//         },
//       ],
//       order: [['time', 'ASC']],
//     });

//     res.status(200).json(appointments);
//   } catch (err) {
//     res.status(500).json({
//       message: "Failed to fetch today's appointments",
//       error: err.message,
//     });
//   }
// };

// GET /api/appointments/today
export const getTodayAppointments = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ); // 00:00 UTC
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    ); // +1 يوم

    const appointments = await Appointment.find({
      date: { $gte: start, $lt: end },
      status: { $ne: 'cancelled' },
    })
      .populate({ path: 'userId', select: 'name', model: User })
      .sort({ time: 1 })
      .lean();

    // alias مثل القديم
    const mapped = appointments.map((a) => ({
      ...a,
      patient: a.userId,
      userId: a.userId?._id || a.userId,
    }));
    res.status(200).json(mapped);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Failed to fetch today's appointments",
        error: err.message,
      });
  }
};

// export const checkAvailability = async (req, res) => {
//   const { date, time } = req.query;

//   if (!date || !time) {
//     return res.status(400).json({ message: 'Date and time are required' });
//   }

//   try {
//     const exists = await req.db.Appointment.findOne({
//       where: { date, time },
//     });

//     if (exists) {
//       return res.status(200).json({ available: false });
//     }

//     return res.status(200).json({ available: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error checking availability' });
//   }
// };

// GET /api/appointments/check?date=YYYY-MM-DD&time=HH:mm
export const checkAvailability = async (req, res) => {
  const { date, time } = req.query;
  if (!date || !time)
    return res.status(400).json({ message: 'Date and time are required' });

  try {
    const d = new Date(date);
    const day = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );

    const exists = await Appointment.exists({
      date: day,
      time,
      status: { $ne: 'cancelled' },
    });

    res.status(200).json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: 'Error checking availability' });
  }
};
