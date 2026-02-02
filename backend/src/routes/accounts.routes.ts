import { Router } from 'express';
import * as accountsController from '../controllers/accounts.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('DISTRIBUTOR', 'RSM', 'ADMIN'), accountsController.getAccounts);
router.post('/', authorize('RSM', 'ADMIN'), accountsController.createAccount);

export default router;
