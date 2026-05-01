// src/routes/serviceRoutes.js
import express from 'express';
import {
  getAllServiceGroups,
  createServiceGroup,
  updateServiceGroup,
  deleteServiceGroup,
  addServiceItem,
  updateServiceItem,
  deleteServiceItem,
} from '../controllers/serviceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getAllServiceGroups);
router.post('/groups', protect, createServiceGroup);
router.put('/:groupId', protect, updateServiceGroup);
router.delete('/:groupId', protect, deleteServiceGroup);

router.post('/:groupId/items', protect, addServiceItem);
router.put('/:groupId/items/:itemId', protect, updateServiceItem);
router.delete('/:groupId/items/:itemId', protect, deleteServiceItem);

export default router;
