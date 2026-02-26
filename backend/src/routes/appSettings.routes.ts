import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { memUpload } from '../middleware/upload';
import * as appSettingsController from '../controllers/appSettings.controller';

const router = Router();

router.get('/generic-thumbnail', authenticate, appSettingsController.getGenericThumbnail);
router.post('/generic-thumbnail', authenticate, authorize('ADMIN'), memUpload.single('image'), appSettingsController.uploadGenericThumbnail);
router.delete('/generic-thumbnail', authenticate, authorize('ADMIN'), appSettingsController.deleteGenericThumbnail);

export default router;
