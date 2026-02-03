import { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller';

const router = Router();

router.post('/resend', webhooksController.handleResendWebhook);

export default router;
