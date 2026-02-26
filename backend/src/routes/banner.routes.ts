import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { memUpload } from '../middleware/upload';
import * as bannerController from '../controllers/banner.controller';

const router = Router();

// Any authenticated user can list active banners (PDF generator uses this)
router.get('/', authenticate, bannerController.listBanners);

// Admin-only: upload, update, delete
router.post('/', authenticate, authorize('ADMIN'), memUpload.single('image'), bannerController.uploadBanner);
router.patch('/:id', authenticate, authorize('ADMIN'), bannerController.updateBanner);
router.delete('/:id', authenticate, authorize('ADMIN'), bannerController.deleteBanner);

export default router;
