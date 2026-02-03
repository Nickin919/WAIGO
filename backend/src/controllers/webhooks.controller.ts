import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Resend webhook: update EmailLog on bounce/complaint.
 * Secure with RESEND_WEBHOOK_SECRET (verify signature per Resend docs).
 */
export async function handleResendWebhook(req: Request, res: Response): Promise<void> {
  try {
    const event = req.body as { type?: string; data?: { email_id?: string } };
    if (event.type === 'email.bounced' && event.data?.email_id) {
      await prisma.emailLog.updateMany({
        where: { resendId: event.data.email_id },
        data: { status: 'bounced', error: JSON.stringify(event) },
      });
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(200); // Acknowledge to avoid retries
  }
}
