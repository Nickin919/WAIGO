import { Router } from 'express';
import * as videoController from '../controllers/video.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadVideo } from '../middleware/upload';

const router = Router();

// Public/authenticated routes
router.get('/feed', authenticate, videoController.getVideoFeed);
router.get('/part/:partId', videoController.getVideosByPart);
router.get('/:id', videoController.getVideoById);
router.post('/:id/view', authenticate, videoController.trackVideoView);

// User routes
router.post('/upload', authenticate, uploadVideo, videoController.uploadVideo);

// Admin routes
router.get('/pending/all', authenticate, authorize('ADMIN'), videoController.getPendingVideos);
router.patch('/:id/approve', authenticate, authorize('ADMIN'), videoController.approveVideo);
router.patch('/:id/reject', authenticate, authorize('ADMIN'), videoController.rejectVideo);
router.delete('/:id', authenticate, authorize('ADMIN'), videoController.deleteVideo);

export default router;
