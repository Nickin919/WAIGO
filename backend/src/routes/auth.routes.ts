import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { uploadAvatar as uploadAvatarMiddleware, uploadLogo as uploadLogoMiddleware } from '../middleware/upload';

const router = Router();

// Register new user
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').optional().trim(),
    body('lastName').optional().trim()
  ],
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  authController.login
);

// Get current user profile
router.get('/me', authenticate, authController.getCurrentUser);

// Get current user's recent activity (quotes, projects, customers)
router.get('/me/activity', authenticate, authController.getMyActivity);

// Update profile
router.patch('/me', authenticate, authController.updateProfile);

// Upload avatar (multipart: avatar = image file)
router.post('/me/avatar', authenticate, uploadAvatarMiddleware, authController.uploadAvatar);

// Upload company logo (multipart: logo = image file; used in Pricing Proposal header for RSM/Distributor)
router.post('/me/logo', authenticate, uploadLogoMiddleware, authController.uploadLogo);

// Change password
router.patch(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
  ],
  authController.changePassword
);

export default router;
