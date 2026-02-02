import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as projectController from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

// Stricter rate limits for heavy operations (per IP, 15 min window)
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX ?? '10', 10),
  message: { error: 'Too many BOM uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const submitRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SUBMIT_MAX ?? '10', 10),
  message: { error: 'Too many project submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
router.post('/:id/upload-bom', uploadRateLimit, uploadCSV, projectController.uploadBOM);
router.patch('/:id/items/:itemId', projectController.updateProjectItem);
router.delete('/:id/items/:itemId', projectController.deleteProjectItem);

// Submit & finalize
router.post('/:id/submit', submitRateLimit, projectController.submitProject);
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
