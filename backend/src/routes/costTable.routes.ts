import { Router } from 'express';
import * as costTableController from '../controllers/costTable.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get cost tables
router.get('/', costTableController.getCostTables);

// Get cost table by ID
router.get('/:id', costTableController.getCostTableById);

// Create cost table (TurnKey+)
router.post('/', authorize('TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'), costTableController.createCostTable);

// Upload cost table from CSV
router.post('/upload', authorize('TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'), uploadCSV, costTableController.uploadCostTableCSV);

// Download cost table as CSV
router.get('/:id/download', costTableController.downloadCostTableCSV);

// Update cost table
router.patch('/:id', costTableController.updateCostTable);

// Delete cost table
router.delete('/:id', costTableController.deleteCostTable);

// Get custom cost for specific part
router.get('/custom-cost/:partNumber', costTableController.getPartCustomCost);

export default router;
