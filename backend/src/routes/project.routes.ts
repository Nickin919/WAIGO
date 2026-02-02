import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/sample-bom', projectController.getBOMSample);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// BOM management
router.post('/:id/items', projectController.addProjectItem);
router.post('/:id/upload-bom', uploadCSV, projectController.uploadBOM);
router.patch('/:id/items/:itemId', projectController.updateProjectItem);
router.delete('/:id/items/:itemId', projectController.deleteProjectItem);

// Submit & finalize
router.post('/:id/submit', projectController.submitProject);
router.post('/:id/finalize', projectController.finalizeProject);

// Cross-reference suggestions
router.get('/:id/suggest-upgrades', projectController.suggestWagoUpgrades);
router.post('/:id/apply-upgrade', projectController.applyWagoUpgrade);

// Revisions
router.post('/:id/create-revision', projectController.createRevision);
router.get('/:id/revisions', projectController.getRevisions);

// Report (Phase 3)
router.get('/:id/report', projectController.getProjectReport);
router.post('/:id/report/email', projectController.emailProjectReport);

export default router;
