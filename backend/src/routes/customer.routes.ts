import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/companies', authenticate, authorize('ADMIN', 'RSM'), customerController.getCompaniesForRsm);
router.get('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.getCustomers);
router.post('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.createCustomer);
router.post('/bulk', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.bulkCreateCustomers);
router.patch('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.updateCustomer);
router.delete('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), customerController.deleteCustomer);

export default router;
