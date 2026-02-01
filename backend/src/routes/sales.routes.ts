import { Router } from 'express';
import * as salesController from '../controllers/sales.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadExcel } from '../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(authorize('RSM', 'ADMIN'));

// Upload Excel sales file
router.post('/upload', uploadExcel, salesController.uploadSales);

// Get sales summary (RSM: own data, Admin: all or ?rsmId=)
router.get('/summary', salesController.getSalesSummary);

// Clear sales data by month or by year (query: year, month optional; Admin can pass rsmId)
router.delete('/by-period', salesController.clearSalesByPeriod);

// List RSMs for Admin dropdown (Admin only)
router.get('/rsms', salesController.getRsms);

export default router;
