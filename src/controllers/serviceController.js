export const getAllServices = async (req, res) => {
  try {
    const services = await req.db.Service.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(services);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch services', error: err.message });
  }
};

export const createService = async (req, res) => {
  const { name, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: 'name and price are required' });
  }

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can create services' });
  }

  try {
    const existing = await req.db.Service.findOne({ where: { name } });
    if (existing) {
      return res
        .status(400)
        .json({ message: 'Service with this name already exists' });
    }

    const service = await req.db.Service.create({ name, price });
    res.status(201).json(service);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create service', error: err.message });
  }
};

export const updateService = async (req, res) => {
  const { name, price } = req.body;
  const { id } = req.params;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can update services' });
  }

  try {
    const service = await req.db.Service.findByPk(id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    service.name = name || service.name;
    service.price = price || service.price;

    await service.save();
    res.status(200).json(service);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update service', error: err.message });
  }
};

export const deleteService = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can delete services' });
  }

  try {
    const service = await req.db.Service.findByPk(id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    await service.destroy();
    res.status(200).json({ message: 'Service deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete service', error: err.message });
  }
};
