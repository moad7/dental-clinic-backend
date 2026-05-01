// src/controllers/serviceController.js
import Service from '../../models/Service.js';

// GET /api/services
export const getAllServiceGroups = async (req, res) => {
  try {
    const groups = await Service.find({}).sort({ createdAt: -1 }).lean();
    res.status(200).json(groups);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch services', error: err.message });
  }
};

// 🟢 POST /api/services/groups
export const createServiceGroup = async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }
  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can create service groups' });
  }

  try {
    const isAvailable = await Service.findOne(title);
    if (isAvailable)
      return res
        .status(404)
        .json({ message: 'Service group is created before' });

    const group = await Service.create({
      title: title.trim(),
    });

    res.status(201).json(group);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to create service group', error: err.message });
  }
};

// 🟢 PUT /api/services/:groupId
// تحديث بيانات المجموعة نفسها (مثلاً تغيير الاسم)
export const updateServiceGroup = async (req, res) => {
  const { groupId } = req.params;
  const { title } = req.body;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can update service groups' });
  }

  try {
    const group = await Service.findById(groupId);
    if (!group)
      return res.status(404).json({ message: 'Service group not found' });

    if (title !== undefined) group.title = title.trim();

    await group.save();
    res.status(200).json(group);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update service group', error: err.message });
  }
};

// 🟢 DELETE /api/services/:groupId
// حذف مجموعة كاملة مع كل الخدمات اللي فيها
export const deleteServiceGroup = async (req, res) => {
  const { groupId } = req.params;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can delete service groups' });
  }
  try {
    const deleted = await Service.findByIdAndDelete(groupId);
    if (!deleted)
      return res.status(404).json({ message: 'Service group not found' });

    res.status(200).json({ message: 'Service group deleted successfully' });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete service group', error: err.message });
  }
};

// 🟢 POST /api/services/:groupId/items
// إضافة خدمة جديدة داخل مجموعة معينة
export const addServiceItem = async (req, res) => {
  const { groupId } = req.params;
  const { name, subSpecialties, price, durationMin, active, photo } = req.body;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can add services' });
  }

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const group = await Service.findById(groupId);
    if (!group)
      return res.status(404).json({ message: 'Service group not found' });

    group.services.push({
      name: name.trim(),
      subSpecialties: Array.isArray(subSpecialties) ? subSpecialties : [],
      price: price !== undefined ? Number(price) : undefined,
      durationMin,
      active,
      photo,
    });

    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to add service item', error: err.message });
  }
};
// 🟢 PUT /api/services/:groupId/items/:itemId
// تعديل خدمة داخل مجموعة
export const updateServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;
  const { name, subSpecialties, price, durationMin, active, photo } = req.body;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can update services' });
  }

  try {
    const group = await Service.findById(groupId);
    if (!group)
      return res.status(404).json({ message: 'Service group not found' });

    const item = group.services.id(itemId);
    if (!item)
      return res.status(404).json({ message: 'Service item not found' });

    if (name !== undefined) item.name = name.trim();
    if (Array.isArray(subSpecialties)) item.subSpecialties = subSpecialties;
    if (price !== undefined) item.price = Number(price);
    if (durationMin !== undefined) item.durationMin = durationMin;
    if (active !== undefined) item.active = active;
    if (photo !== undefined) item.photo = photo;

    await group.save();
    res.status(200).json(group);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update service item', error: err.message });
  }
};

// 🟢 DELETE /api/services/:groupId/items/:itemId
// حذف خدمة من داخل مجموعة
export const deleteServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;

  if (req.user.role !== 'secretary') {
    return res
      .status(403)
      .json({ message: 'Only secretaries can delete services' });
  }

  try {
    const group = await Service.findById(groupId);
    if (!group)
      return res.status(404).json({ message: 'Service group not found' });

    const item = group.services.id(itemId);
    if (!item)
      return res.status(404).json({ message: 'Service item not found' });

    item.deleteOne();
    await group.save();

    res
      .status(200)
      .json({ message: 'Service item deleted successfully', group });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to delete service item', error: err.message });
  }
};
