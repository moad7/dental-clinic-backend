
export const createTreatment = async (req, res) => {
  const { userId, serviceId, totalSessions, note } = req.body;

  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res
      .status(403)
      .json({ message: 'Only secretaries or doctors can create treatments' });
  }

  if (!userId || !serviceId || !totalSessions) {
    return res
      .status(400)
      .json({ message: 'userId, serviceId and totalSessions are required' });
  }

  try {
    const treatment = await req.db.Treatment.create({
      userId,
      serviceId,
      totalSessions,
      note,
    });

    res
      .status(201)
      .json({ message: 'Treatment created successfully', treatment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create treatment', error: err.message });
  }
};

export const getAllTreatments = async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'secretary') {
    return res.status(403).json({ message: 'Unauthorized to view treatments' });
  }

  try {
    const treatments = await req.db.Treatment.findAll({
      include: [
        {
          model: req.db.User,
          as: 'patient',
          attributes: ['id', 'name', 'phoneNumber'],
        },
        { model: req.db.Service, attributes: ['id', 'name', 'price'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json(treatments);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch treatments', error: err.message });
  }
};

export const getMyTreatments = async (req, res) => {
  if (req.user.role !== 'patient') {
    return res
      .status(403)
      .json({ message: 'Only patients can access their own treatments' });
  }

  try {
    const treatments = await req.db.Treatment.findAll({
      where: { userId: req.user.userId },
      include: [{ model: req.db.Service }],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json(treatments);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch treatments', error: err.message });
  }
};

export const updateTreatment = async (req, res) => {
  const { id } = req.params;
  const { totalSessions, note, status, serviceId } = req.body;

  if (req.user.role !== 'secretary' && req.user.role !== 'doctor') {
    return res
      .status(403)
      .json({ message: 'Only secretaries or doctors can update treatments' });
  }

  try {
    const treatment = await req.db.Treatment.findByPk(id);
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    if (totalSessions !== undefined) treatment.totalSessions = totalSessions;
    if (note !== undefined) treatment.note = note;
    if (status !== undefined) treatment.status = status;
    if (serviceId !== undefined) treatment.serviceId = serviceId;

    await treatment.save();

    res
      .status(200)
      .json({ message: 'Treatment updated successfully', treatment });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update treatment', error: err.message });
  }
};
