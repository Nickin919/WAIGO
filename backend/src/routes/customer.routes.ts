import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.getCustomers);
router.post('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.createCustomer);

export default router;
