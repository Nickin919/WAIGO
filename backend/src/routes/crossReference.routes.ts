import { Router } from 'express';
import * as crossRefController from '../controllers/crossReference.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public lookup
router.get('/lookup', crossRefController.lookupCrossReference);

// Admin management
router.post('/', authenticate, authorize('ADMIN'), crossRefController.createCrossReference);
router.patch('/:id', authenticate, authorize('ADMIN'), crossRefController.updateCrossReference);
router.delete('/:id', authenticate, authorize('ADMIN'), crossRefController.deleteCrossReference);

export default router;
