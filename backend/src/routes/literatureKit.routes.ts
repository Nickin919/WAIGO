import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/literatureKit.controller';

const router = Router();

// All routes require authentication; ownership enforced in the service layer
router.get('/', authenticate, ctrl.listKitsHandler);
router.post('/', authenticate, ctrl.createKitHandler);
router.get('/:id', authenticate, ctrl.getKitHandler);
router.patch('/:id', authenticate, ctrl.updateKitHandler);
router.delete('/:id', authenticate, ctrl.deleteKitHandler);
router.post('/:id/items', authenticate, ctrl.addItemsHandler);
router.delete('/:id/items/:litId', authenticate, ctrl.removeItemHandler);
router.get('/:id/zip', authenticate, ctrl.downloadZipHandler);
router.get('/:id/slip', authenticate, ctrl.downloadSlipHandler);

export default router;
