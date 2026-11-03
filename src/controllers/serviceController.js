// src/controllers/serviceController.js
import mongoose from 'mongoose';
import Service from '../../models/Service.js';
import Treatment from '../../models/Treatment.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import User from '../../models/User.js';
// GET /api/services
export const getAllServiceGroups = async (req, res) => {
  try {
    const { view = 'available' } = req.query;
    if (!['all', 'available'].includes(view)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid services view',
      });
    }
    const groups = await Service.find(
      view === 'all' ? {} : { isArchived: { $ne: true } },
    )
      .sort({ createdAt: -1 })
      .lean();
    if (view === 'all') {
      return res.status(200).json(groups);
    }
    const availableGroups = groups
      .map((group) => ({
        ...group,
        services: (group.services || []).filter(
          (item) => item.active === true && item.isArchived !== true,
        ),
      }))
      .filter((group) => group.services.length > 0);
    return res.status(200).json(availableGroups);
  } catch (error) {
    console.error('getAllServiceGroups error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message,
    });
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
    const isAvailable = await Service.findOne({ title: title });
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
export const deleteServiceGroup = async (req, res) => {
  const { groupId } = req.params;
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
// POST /api/services/:groupId/items
export const addServiceItem = async (req, res) => {
  const { groupId } = req.params;
  const { name, description, price, durationMin, active, imageUrl } = req.body;
  try {
    const group = await Service.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Service group not found',
      });
    }
    const existingItem = group.services.find(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (existingItem) {
      return res.status(409).json({
        message: 'Service item already exists',
      });
    }
    if (durationMin < 5) {
      return res.status(400).json({
        message: 'Duration must be at least 5 minutes',
      });
    }
    let photo = '';
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
      photo = uploadResult.secure_url;
    } else if (imageUrl?.trim()) {
      photo = imageUrl.trim();
    }
    group.services.push({
      name: name.trim(),
      description: description?.trim() || '',
      price: price !== undefined && price !== '' ? Number(price) : 0,
      durationMin:
        durationMin !== undefined && durationMin !== ''
          ? Number(durationMin)
          : undefined,
      active:
        active !== undefined ? active === true || active === 'true' : true,
      photo,
    });
    await group.save();
    return res.status(201).json(group);
  } catch (err) {
    console.error('addServiceItem error:', err);
    return res.status(500).json({
      message: 'Failed to add service item',
      error: err.message,
    });
  }
};
// 🟢 PUT /api/services/:groupId/items/:itemId
export const updateServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;
  const { name, description, price, durationMin, active, imageUrl } = req.body;
  try {
    const group = await Service.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Service group not found',
      });
    }
    const item = group.services.id(itemId);
    if (!item) {
      return res.status(404).json({
        message: 'Service item not found',
      });
    }
    if (item.isArchived && (active === true || active === 'true')) {
      return res.status(409).json({
        success: false,
        code: 'SERVICE_ARCHIVED',
        message: 'Cannot activate an archived service',
      });
    }
    if (name !== undefined) {
      item.name = name.trim();
    }
    if (description !== undefined) {
      item.description = description.trim();
    }
    if (price !== undefined && price !== '') {
      item.price = Number(price);
    }
    if (durationMin !== undefined && durationMin !== '') {
      item.durationMin = Number(durationMin);
    }
    if (active !== undefined) {
      item.active = active === true || active === 'true';
    }
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
      item.photo = uploadResult.secure_url;
    } else if (imageUrl?.trim()) {
      item.photo = imageUrl.trim();
    }
    await group.save();
    return res.status(200).json(group);
  } catch (err) {
    console.error('updateServiceItem:', err);
    return res.status(500).json({
      message: 'Failed to update service item',
      error: err.message,
    });
  }
};
// 🟢 DELETE /api/services/:groupId/items/:itemId
export const deleteServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid service group or item id',
    });
  }
  try {
    const group = await Service.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Service group not found',
      });
    }
    const item = group.services.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Service item not found',
      });
    }
    const usedInTreatment = await Treatment.exists({
      serviceGroupId: group._id,
      serviceItemId: item._id,
    });
    if (usedInTreatment) {
      return res.status(409).json({
        success: false,
        code: 'SERVICE_IN_USE',
        message:
          'Cannot delete this service because it is linked to existing treatments',
      });
    }
    const isLastService = group.services.length === 1;
    if (isLastService) {
      const groupUsedInTreatment = await Treatment.exists({
        serviceGroupId: group._id,
      });
      if (groupUsedInTreatment) {
        return res.status(409).json({
          success: false,
          code: 'SERVICE_GROUP_IN_USE',
          message:
            'Cannot delete this group because it is linked to existing treatments',
        });
      }
      await User.updateMany(
        {
          role: 'doctor',
          'doctor.services.groupId': group._id,
        },
        {
          $pull: {
            'doctor.services': {
              groupId: group._id,
            },
          },
        },
      );
      await Service.deleteOne({ _id: group._id });
      return res.status(200).json({
        success: true,
        code: 'SERVICE_GROUP_DELETED',
        message: 'Last service and its group deleted successfully',
        deletedServiceId: item._id,
        deletedGroupId: group._id,
        groupDeleted: true,
      });
    }
    item.deleteOne();
    await group.save();
    return res.status(200).json({
      success: true,
      code: 'SERVICE_ITEM_DELETED',
      message: 'Service item deleted successfully',
      groupDeleted: false,
      group,
    });
  } catch (error) {
    console.error('deleteServiceItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service item',
      error: error.message,
    });
  }
};
// PATCH /api/services/:groupId/items/:itemId/archive
export const archiveServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid service group or item id',
    });
  }
  try {
    const group = await Service.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Service group not found',
      });
    }
    const item = group.services.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Service item not found',
      });
    }
    if (item.isArchived) {
      return res.status(409).json({
        success: false,
        code: 'SERVICE_ALREADY_ARCHIVED',
        message: 'Service is already archived',
      });
    }
    item.active = false;
    item.isArchived = true;
    item.archivedAt = new Date();
    await group.save();
    return res.status(200).json({
      success: true,
      message: 'Service archived successfully',
      group,
    });
  } catch (error) {
    console.error('archiveServiceItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to archive service',
      error: error.message,
    });
  }
};
// PATCH /api/services/:groupId/items/:itemId/restore
export const restoreServiceItem = async (req, res) => {
  const { groupId, itemId } = req.params;
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid service group or item id',
    });
  }
  try {
    const group = await Service.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Service group not found',
      });
    }
    const item = group.services.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Service item not found',
      });
    }
    if (!item.isArchived) {
      return res.status(409).json({
        success: false,
        code: 'SERVICE_NOT_ARCHIVED',
        message: 'Service is not archived',
      });
    }
    item.active = true;
    item.isArchived = false;
    item.archivedAt = null;
    await group.save();
    return res.status(200).json({
      success: true,
      message: 'Service restored successfully',
      group,
    });
  } catch (error) {
    console.error('restoreServiceItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore service',
      error: error.message,
    });
  }
};
export const getServiceArchivePreview = async (req, res) => {
  const { groupId, itemId } = req.params;
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({
      message: 'Invalid service group or item id',
    });
  }
  try {
    const group = await Service.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({
        message: 'Service group not found',
      });
    }
    const item = group.services.find(
      (service) => String(service._id) === String(itemId),
    );
    if (!item) {
      return res.status(404).json({
        message: 'Service item not found',
      });
    }
    const treatments = await Treatment.find({
      serviceGroupId: group._id,
      serviceItemId: item._id,
    })
      .select('_id status totalSessions createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const stats = {
      totalTreatments: treatments.length,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
      futureAppointments: 0,
    };
    for (const treatment of treatments) {
      if (treatment.status === 'in_progress') stats.inProgress++;
      if (treatment.status === 'completed') stats.completed++;
      if (treatment.status === 'cancelled') stats.cancelled++;
      if (treatment.status === 'rejected') stats.rejected++;
    }
    const treatmentIds = treatments.map((t) => t._id);
    if (treatmentIds.length > 0) {
      // Dates in TreatmentSession are stored as UTC date-only.
      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      stats.futureAppointments = await TreatmentSession.countDocuments({
        treatmentId: { $in: treatmentIds },
        date: { $gte: todayUTC },
        status: { $in: ['pending', 'confirmed'] },
      });
    }
    return res.status(200).json({
      service: {
        _id: item._id,
        name: item.name,
        active: item.active,
        isArchived: item.isArchived,
      },
      stats,
      treatments,
    });
  } catch (error) {
    console.error('getServiceArchivePreview:', error);
    return res.status(500).json({
      message: 'Failed to fetch archive preview',
      error: error.message,
    });
  }
};
