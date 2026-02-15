import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Bulk operations
router.post('/bulk-approve-videos', adminController.bulkApproveVideos);

// BOM Data Management (cross-references, non-WAGO products)
router.get('/cross-references/sample', adminController.getCrossReferencesSample);
router.post('/cross-references/import', uploadCSV, adminController.importCrossReferences);
router.post('/cross-references/import-master', adminController.importCrossReferencesMaster);
router.get('/non-wago-products/sample', adminController.getNonWagoProductsSample);
router.post('/non-wago-products/import', uploadCSV, adminController.importNonWagoProducts);

export default router;
