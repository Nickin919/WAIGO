import { Router } from 'express';
import * as quoteController from '../controllers/quote.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

// Authenticated routes
router.get('/', authenticate, quoteController.getQuotes);
router.get('/:id', authenticate, quoteController.getQuoteById);
router.post('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.createQuote);
router.post('/upload-csv', authenticate, authorize('ADMIN', 'DISTRIBUTOR'), uploadCSV, quoteController.uploadQuoteCSV);
router.get('/:id/download-csv', authenticate, quoteController.downloadQuoteCSV);
router.get('/:id/pdf', authenticate, quoteController.generateQuotePDF);
router.patch('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.updateQuote);
router.delete('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.deleteQuote);

export default router;
