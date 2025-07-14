// إضافة جلسة علاج جديدة
export const createSession = async (req, res) => {
  const { treatmentId, date, time, note } = req.body;

  if (req.user.role !== 'doctor' && req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only doctors or secretaries can create sessions' });
  }

  if (!treatmentId || !date || !time) {
    return res
      .status(400)
      .json({ message: 'treatmentId, date and time are required' });
  }

  try {
    const session = await req.db.TreatmentSession.create({
      treatmentId,
      date,
      time,
      note,
    });

    res.status(201).json({ message: 'Session created successfully', session });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create session', error: err.message });
  }
};

// تعديل جلسة علاج
export const updateSession = async (req, res) => {
  const { id } = req.params;
  const { date, time, status, note } = req.body;

  if (req.user.role !== 'doctor' && req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only doctors or secretaries can update sessions' });
  }

  try {
    const session = await req.db.TreatmentSession.findByPk(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (date !== undefined) session.date = date;
    if (time !== undefined) session.time = time;
    if (status !== undefined) session.status = status;
    if (note !== undefined) session.note = note;

    await session.save();
    res.status(200).json({ message: 'Session updated successfully', session });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update session', error: err.message });
  }
};

// حذف جلسة علاج
export const deleteSession = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'doctor' && req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only doctors or secretaries can delete sessions' });
  }

  try {
    const session = await req.db.TreatmentSession.findByPk(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await session.destroy();
    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete session', error: err.message });
  }
};
export const getSessionsByTreatment = async (req, res) => {
  const { treatmentId } = req.params;

  try {
    const sessions = await req.db.TreatmentSession.findAll({
      where: { treatmentId },
      order: [
        ['date', 'ASC'],
        ['time', 'ASC'],
      ],
    });

    res.status(200).json(sessions);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch sessions', error: err.message });
  }
};
