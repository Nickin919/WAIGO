import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', catalogController.getAllCatalogs);
// Must be before /:id so "my-summary" is not treated as id
router.get('/my-summary', authenticate, catalogController.getMyCatalogSummary);
router.get('/:id', catalogController.getCatalogById);

// Protected routes (admin only)
router.post('/', authenticate, authorize('ADMIN'), catalogController.createCatalog);
router.patch('/:id', authenticate, authorize('ADMIN'), catalogController.updateCatalog);
router.delete('/:id', authenticate, authorize('ADMIN'), catalogController.deleteCatalog);

// Get catalog statistics
router.get('/:id/stats', authenticate, catalogController.getCatalogStats);

export default router;
