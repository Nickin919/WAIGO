import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as quoteController from '../controllers/quote.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadCSV } from '../middleware/upload';

const router = Router();

const sendQuoteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SEND_QUOTE_MAX ?? '20', 10),
  message: { error: 'Too many quote emails. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authenticated routes
router.get('/', authenticate, quoteController.getQuotes);
router.get('/:id', authenticate, quoteController.getQuoteById);
router.get('/:id/literature/suggested', authenticate, quoteController.getSuggestedLiteratureHandler);
router.get('/:id/literature', authenticate, quoteController.getQuoteLiteratureHandler);
router.post('/:id/literature/attach', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.attachLiteratureHandler);
router.post('/', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.createQuote);
router.post('/upload-csv', authenticate, authorize('ADMIN', 'DISTRIBUTOR'), uploadCSV, quoteController.uploadQuoteCSV);
router.get('/:id/download-csv', authenticate, quoteController.downloadQuoteCSV);
router.get('/:id/pdf', authenticate, quoteController.generateQuotePDF);
router.post('/:id/send', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), sendQuoteRateLimit, quoteController.sendQuoteEmailHandler);
router.patch('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.updateQuote);
router.delete('/:id', authenticate, authorize('ADMIN', 'RSM', 'DISTRIBUTOR', 'TURNKEY', 'BASIC'), quoteController.deleteQuote);

export default router;
