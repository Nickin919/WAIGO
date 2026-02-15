import React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import QuoteEmail from '../emails/QuoteEmail';
import { prisma } from './prisma';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set. Configure it to send quote emails.');
  }
  return new Resend(key);
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'WAIGO Sales <sales@waigo.app>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export interface SendQuoteEmailParams {
  to: string;
  bcc?: string[];
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  quoteSummary: string;
  pdfBuffer?: Buffer;
  literatureAttachments?: { filename: string; content: Buffer }[];
}

/**
 * Send quote email via Resend. Renders React Email template, optionally attaches PDF.
 * Logs success/failure to EmailLog.
 */
export async function sendQuoteEmail(params: SendQuoteEmailParams): Promise<{ id?: string }> {
  const {
    to,
    bcc = [],
    quoteId,
    quoteNumber,
    customerName,
    quoteSummary,
    pdfBuffer,
    literatureAttachments = [],
  } = params;

  const viewQuoteUrl = `${FRONTEND_URL}/quotes/${quoteId}`;
  const html = await render(
    React.createElement(QuoteEmail, {
      customerName,
      quoteId,
      quoteNumber,
      quoteSummary,
      viewQuoteUrl,
    })
  );

  const attachments: { filename: string; content: Buffer }[] = [];
  if (pdfBuffer) {
    attachments.push({ filename: `PricingProposal_${quoteNumber.replace(/#/g, '')}.pdf`, content: pdfBuffer });
  }
  for (const att of literatureAttachments) {
    attachments.push({ filename: att.filename, content: att.content });
  }

  const bccFiltered = process.env.EMAIL_BCC ? [...bcc, process.env.EMAIL_BCC] : bcc;

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      bcc: bccFiltered.length > 0 ? bccFiltered : undefined,
      subject: `WAIGO Pricing Proposal ${quoteNumber} – ${customerName}`,
      html,
      attachments:
        attachments.length > 0
          ? attachments.map((att) => ({
              filename: att.filename,
              content: att.content.toString('base64'),
            }))
          : undefined,
    });

    if (error) throw error;

    await prisma.emailLog.create({
      data: {
        quoteId,
        recipient: to,
        subject: `WAIGO Pricing Proposal ${quoteNumber}`,
        status: 'sent',
        resendId: data?.id ?? null,
      },
    });

    return { id: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    await prisma.emailLog.create({
      data: {
        quoteId,
        recipient: to,
        subject: `WAIGO Pricing Proposal ${quoteNumber}`,
        status: 'failed',
        error: errorMessage,
      },
    });
    throw err;
  }
}
