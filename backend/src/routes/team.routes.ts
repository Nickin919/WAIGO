import { Router } from 'express';
import * as teamController from '../controllers/team.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get teams (filtered by user role)
router.get('/', teamController.getTeams);

// Get team by ID
router.get('/:id', teamController.getTeamById);

// Create team (RSM, Admin)
router.post('/', authorize('RSM', 'ADMIN'), teamController.createTeam);

// Update team (RSM, Admin)
router.patch('/:id', authorize('RSM', 'ADMIN'), teamController.updateTeam);

// Delete team (Admin only)
router.delete('/:id', authorize('ADMIN'), teamController.deleteTeam);

// Add member to team (RSM, Admin)
router.post('/members', authorize('RSM', 'ADMIN'), teamController.addTeamMember);

// Remove member from team (RSM, Admin)
router.delete('/:teamId/members/:userId', authorize('RSM', 'ADMIN'), teamController.removeTeamMember);

export default router;
