import { Router } from 'express';
import * as priceContractController from '../controllers/priceContract.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadPDF } from '../middleware/upload';

const router = Router();

router.get('/', authenticate, priceContractController.list);
router.post('/', authenticate, authorize('ADMIN', 'RSM'), priceContractController.create);
router.get('/:id', authenticate, priceContractController.getById);
router.patch('/:id', authenticate, authorize('ADMIN', 'RSM'), priceContractController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'RSM'), priceContractController.remove);
router.post('/:id/items', authenticate, authorize('ADMIN', 'RSM'), priceContractController.addItems);
router.patch('/:id/items/:itemId', authenticate, authorize('ADMIN', 'RSM'), priceContractController.updateItem);
router.delete('/:id/items/:itemId', authenticate, authorize('ADMIN', 'RSM'), priceContractController.removeItem);
router.post('/:id/items/upload-pdf', authenticate, authorize('ADMIN', 'RSM'), uploadPDF, priceContractController.uploadPDF);

export default router;
