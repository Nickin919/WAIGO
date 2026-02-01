import { Router } from 'express';
import * as priceContractController from '../controllers/priceContract.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.patch('/contracts/:contractId/items', authenticate, priceContractController.updateMyContractItems);

export default router;
