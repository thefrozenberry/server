import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { logger } from './logger';

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465, // true for 465, false for other ports
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

/**
 * Send email
 * @param to Recipient email address
 * @param subject Email subject
 * @param html Email HTML content
 * @param attachments Email attachments
 * @returns Promise resolving to the email info
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments: any[] = []
): Promise<any> => {
  try {
    const mailOptions = {
      from: `SWRZEE <${config.email.user}>`,
      to,
      subject,
      html,
      attachments,
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    
    return info;
  } catch (error: any) {
    logger.error(`Failed to send email: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send welcome email
 * @param to Recipient email address
 * @param name Recipient name
 * @returns Promise resolving to the email info
 */
export const sendWelcomeEmail = async (to: string, name: string): Promise<any> => {
  const subject = 'Welcome to SWRZEE!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to SWRZEE!</h2>
      <p>Hello ${name},</p>
      <p>Thank you for registering with SWRZEE. We're excited to have you on board!</p>
      <p>You can now log in to your account and explore our services.</p>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The SWRZEE Team</p>
    </div>
  `;
  
  return sendEmail(to, subject, html);
};

/**
 * Send payment confirmation email
 * @param to Recipient email address
 * @param name Recipient name
 * @param amount Payment amount
 * @param batchName Batch name
 * @param receiptPath Receipt file path
 * @returns Promise resolving to the email info
 */
export const sendPaymentConfirmationEmail = async (
  to: string,
  name: string,
  amount: number,
  batchName: string,
  receiptPath: string
): Promise<any> => {
  const subject = 'Payment Confirmation';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Payment Confirmation</h2>
      <p>Hello ${name},</p>
      <p>Thank you for your payment of Rs. ${(amount / 100).toFixed(2)} for ${batchName}.</p>
      <p>Your payment has been successfully processed. Please find the receipt attached.</p>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The SWRZEE Team</p>
    </div>
  `;
  
  const attachments = [
    {
      filename: 'receipt.pdf',
      path: receiptPath,
    },
  ];
  
  return sendEmail(to, subject, html, attachments);
};

/**
 * Send OTP email
 * @param to Recipient email address
 * @param otp OTP code
 * @param purpose Purpose of OTP
 * @returns Promise resolving to the email info
 */
export const sendOtpEmail = async (
  to: string,
  otp: string,
  purpose: 'registration' | 'login' | 'reset-password'
): Promise<any> => {
  let subject = '';
  let action = '';
  
  switch (purpose) {
    case 'registration':
      subject = 'Registration OTP';
      action = 'register';
      break;
    case 'login':
      subject = 'Login OTP';
      action = 'log in';
      break;
    case 'reset-password':
      subject = 'Reset Password OTP';
      action = 'reset your password';
      break;
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Your OTP to ${action} is:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; margin: 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${otp}</h1>
      <p>This OTP will expire in ${config.otp.expiryMinutes} minutes.</p>
      <p>If you did not request this OTP, please ignore this email.</p>
      <p>Best regards,<br>The SWRZEE Team</p>
    </div>
  `;
  
  return sendEmail(to, subject, html);
}; 