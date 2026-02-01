import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using configured SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    });
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send video approval notification
 */
export const sendVideoApprovalEmail = async (
  userEmail: string,
  videoTitle: string,
  partNumber: string
): Promise<void> => {
  const html = `
    <h2>New Video Approved!</h2>
    <p>A new video has been approved in your catalog:</p>
    <ul>
      <li><strong>Video:</strong> ${videoTitle}</li>
      <li><strong>Part Number:</strong> ${partNumber}</li>
    </ul>
    <p>Log in to WAGO Project Hub to watch it!</p>
  `;

  await sendEmail({
    to: userEmail,
    subject: `New Video: ${videoTitle}`,
    html
  });
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (
  userEmail: string,
  firstName?: string
): Promise<void> => {
  const html = `
    <h2>Welcome to WAGO Project Hub!</h2>
    <p>Hi ${firstName || 'there'},</p>
    <p>Your account has been created successfully. You can now access your catalog, watch videos, and create projects.</p>
    <p>Visit <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a> to get started!</p>
  `;

  await sendEmail({
    to: userEmail,
    subject: 'Welcome to WAGO Project Hub',
    html
  });
};
