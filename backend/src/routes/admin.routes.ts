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
router.post('/import-cross-references', uploadCSV, adminController.importCrossReferences);

export default router;
