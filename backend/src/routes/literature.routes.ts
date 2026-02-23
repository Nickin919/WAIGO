import { Router } from 'express';
import * as literatureController from '../controllers/literature.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadLiterature, uploadCSV } from '../middleware/upload';

const router = Router();

// List and get: any authenticated user
router.get('/', authenticate, literatureController.getLiteratureList);
router.get('/sample-csv', authenticate, authorize('ADMIN'), literatureController.getSampleCsv);
router.get('/export/pdf', authenticate, authorize('ADMIN'), literatureController.exportPdf);
router.get('/export/csv', authenticate, authorize('ADMIN'), literatureController.exportCsv);
router.get('/settings/zip-milestone', authenticate, authorize('ADMIN'), literatureController.getZipMilestoneHandler);
router.put('/settings/zip-milestone', authenticate, authorize('ADMIN'), literatureController.putZipMilestoneHandler);
router.post('/bulk-update-associations', authenticate, authorize('ADMIN'), uploadCSV, literatureController.bulkUpdateAssociations);

router.get('/:id', authenticate, literatureController.getLiterature);

// Admin-only: upload, update, delete
router.post('/', authenticate, authorize('ADMIN'), uploadLiterature, literatureController.uploadLiterature);
router.patch('/:id', authenticate, authorize('ADMIN'), literatureController.patchLiteratureMetadata);
router.patch('/:id/associations', authenticate, authorize('ADMIN'), literatureController.patchLiteratureAssociations);
router.delete('/:id', authenticate, authorize('ADMIN'), literatureController.deleteLiteratureHandler);

export default router;
