import { Router } from 'express';
import * as assignmentsController from '../controllers/assignments.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, assignmentsController.getMyAssignments);
router.get('/tree', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR'), assignmentsController.getTree);
router.get('/users', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR'), assignmentsController.getUsers);
router.post('/catalogs', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR'), assignmentsController.assignCatalogs);
router.post('/contracts', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR'), assignmentsController.assignContracts);

export default router;
