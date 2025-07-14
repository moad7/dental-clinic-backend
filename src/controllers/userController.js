export const getAllPatients = async (req, res) => {
  try {
    const patients = await req.db.User.findAll({
      attributes: ['id', 'name', 'phoneNumber', 'role'],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(patients);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch patients', error: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await req.db.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, phoneNumber, role } = req.body;
    user.name = name || user.name;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.role = role || user.role;

    await user.save();

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update user', error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await req.db.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete user', error: err.message });
  }
};

export const getPatientDetails = async (req, res) => {
  try {
    const patient = await req.db.User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'phoneNumber', 'role'],
      include: [
        {
          model: req.db.Appointment,
          as: 'Appointments',
          attributes: ['id', 'date', 'time', 'status', 'note'],
          include: [
            {
              model: req.db.Treatment,
              as: 'Treatments',
              include: [
                {
                  model: req.db.TreatmentSession,
                  as: 'Sessions',
                  attributes: ['id', 'date', 'note', 'status'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    res.status(200).json(patient);
  } catch (err) {
    console.log(err);

    res
      .status(500)
      .json({ message: 'Failed to fetch patient', error: err.message });
  }
};
