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
import { uploadServiceImage } from '../middleware/uploadMiddleware.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/', protect, getAllServiceGroups);
router.post('/groups', protect, createServiceGroup);
router.put('/:groupId', protect, updateServiceGroup);
router.delete('/:groupId', protect, deleteServiceGroup);
router.post(
  '/:groupId/items',
  protect,
  uploadServiceImage.single('photo'),
  addServiceItem,
);
router.put(
  '/:groupId/items/:itemId',
  protect,
  uploadServiceImage.single('photo'),
  updateServiceItem,
);
router.delete(
  '/:groupId/items/:itemId',
  protect,
  authorize('secretary'),
  deleteServiceItem,
);
export default router;
