import { Router } from 'express';
import * as partController from '../controllers/part.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Bulk part lookup for quotes
router.post('/lookup-bulk', authenticate, partController.lookupBulkParts);

// Public/authenticated routes
router.get('/catalog/:catalogId', partController.getPartsByCatalog);
router.get('/category/:categoryId', partController.getPartsByCategory);
router.get('/:id', partController.getPartById);
router.get('/number/:partNumber', partController.getPartByNumber);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), partController.createPart);
router.patch('/:id', authenticate, authorize('ADMIN'), partController.updatePart);
router.delete('/:id', authenticate, authorize('ADMIN'), partController.deletePart);

export default router;
