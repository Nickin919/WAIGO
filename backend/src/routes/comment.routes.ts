import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get comments for video
router.get('/video/:videoId', commentController.getCommentsByVideo);

// Authenticated routes
router.post('/', authenticate, commentController.createComment);
router.patch('/:id', authenticate, commentController.updateComment);
router.delete('/:id', authenticate, commentController.deleteComment);
router.post('/:id/like', authenticate, commentController.likeComment);

export default router;
