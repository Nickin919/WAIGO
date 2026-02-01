import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public/authenticated routes
router.get('/catalog/:catalogId', categoryController.getCategoriesByCatalog);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/children', categoryController.getCategoryChildren);
router.get('/:id/breadcrumb', categoryController.getCategoryBreadcrumb);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), categoryController.createCategory);
router.patch('/:id', authenticate, authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.deleteCategory);
router.patch('/:id/reorder', authenticate, authorize('ADMIN'), categoryController.reorderCategory);

export default router;
