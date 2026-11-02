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
  archiveServiceItem,
  restoreServiceItem,
  getServiceArchivePreview,
} from '../controllers/serviceController.js';
import { uploadServiceImage } from '../middleware/uploadMiddleware.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/', protect, getAllServiceGroups);
router.post('/groups', protect, authorize('secretary'), createServiceGroup);
router.put('/:groupId', protect, authorize('secretary'), updateServiceGroup);
router.delete('/:groupId', protect, authorize('secretary'), deleteServiceGroup);
router.post(
  '/:groupId/items',
  protect,
  uploadServiceImage.single('photo'),
  authorize('secretary'),
  addServiceItem,
);
router.put(
  '/:groupId/items/:itemId',
  protect,
  uploadServiceImage.single('photo'),
  authorize('secretary'),
  updateServiceItem,
);
router.delete(
  '/:groupId/items/:itemId',
  protect,
  authorize('secretary'),
  deleteServiceItem,
);
router.patch(
  '/:groupId/items/:itemId/archive',
  protect,
  authorize('secretary'),
  archiveServiceItem,
);
router.patch(
  '/:groupId/items/:itemId/restore',
  protect,
  authorize('secretary'),
  restoreServiceItem,
);
router.get(
  '/:groupId/items/:itemId/archive-preview',
  protect,
  authorize('secretary'),
  getServiceArchivePreview,
);
export default router;
