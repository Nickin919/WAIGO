import { Router } from 'express';
import * as productImportController from '../controllers/productImport.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require ADMIN authentication
router.use(authenticate, authorize('ADMIN'));

// Bulk import products
router.post('/import', productImportController.bulkImportProducts);

// Get price history for a product
router.get('/:partNumber/price-history', productImportController.getPriceHistory);

// Get import batch summary
router.get('/import-batch/:batchId', productImportController.getImportBatchSummary);

// Get import statistics
router.get('/import-stats', productImportController.getImportStats);

export default router;
