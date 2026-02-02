import { Router } from 'express';
import * as userMgmtController from '../controllers/userManagement.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get users (filtered by role)
router.get('/', userMgmtController.getUsers);

// Get user hierarchy
router.get('/hierarchy/:userId?', userMgmtController.getUserHierarchy);

// Get managed users activity (Distributor, RSM, Admin)
router.get('/activity', authorize('DISTRIBUTOR', 'RSM', 'ADMIN'), userMgmtController.getManagedUsersActivity);

// Assign user to distributor (RSM, Admin)
router.post('/assign-to-distributor', authorize('RSM', 'ADMIN'), userMgmtController.assignUserToDistributor);

// Assign distributor to RSM (Admin only)
router.post('/assign-distributor-to-rsm', authorize('ADMIN'), userMgmtController.assignDistributorToRsm);

// Assign user(s) to company (account)
router.post('/assign-to-account', authorize('DISTRIBUTOR', 'RSM', 'ADMIN'), userMgmtController.assignUserToAccount);

// Update user role (Admin only)
router.patch('/:userId/role', authorize('ADMIN'), userMgmtController.updateUserRole);

export default router;
