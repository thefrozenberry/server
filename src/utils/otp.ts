import { OTP } from '../models/OTP';
import { logger } from './logger';
import { config } from '../config/config';

type OTPPurpose = 'registration' | 'login' | 'reset-password';

/**
 * Generate a random OTP
 * @param length Length of OTP (default: 6)
 * @returns Random OTP
 */
export const generateOTP = (length = 6): string => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

/**
 * Create and save OTP to database
 * @param phoneNumber User phone number
 * @param purpose Purpose of OTP
 * @returns Generated OTP
 */
export const createOTP = async (phoneNumber: string, purpose: OTPPurpose): Promise<string> => {
  // Generate OTP
  const otp = generateOTP();
  
  // Calculate expiry time
  const expiryMinutes = config.otp.expiryMinutes;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  // Delete any existing OTPs for this phone number and purpose
  await OTP.deleteMany({ phoneNumber, purpose });
  
  // Create new OTP
  await OTP.create({
    phoneNumber,
    otp,
    purpose,
    expiresAt,
    verified: false,
  });
  
  // In production, this would be sent via SMS
  // For now, log it to the console
  logger.info(`OTP for ${phoneNumber} (${purpose}): ${otp}`);
  
  return otp;
};

/**
 * Verify OTP
 * @param phoneNumber User phone number
 * @param otp OTP to verify
 * @param purpose Purpose of OTP
 * @returns True if OTP is valid, false otherwise
 */
export const verifyOTP = async (phoneNumber: string, otp: string, purpose: OTPPurpose): Promise<boolean> => {
  // Find OTP in database
  const otpRecord = await OTP.findOne({
    phoneNumber,
    otp,
    purpose,
    expiresAt: { $gt: new Date() },
    verified: false,
  });
  
  if (!otpRecord) {
    return false;
  }
  
  // Mark OTP as verified
  otpRecord.verified = true;
  await otpRecord.save();
  
  return true;
};

/**
 * Send OTP via SMS (mock implementation)
 * @param phoneNumber User phone number
 * @param otp OTP to send
 * @param purpose Purpose of OTP
 */
export const sendOTP = async (phoneNumber: string, otp: string, purpose: OTPPurpose): Promise<void> => {
  // In production, this would send an SMS via Twilio/msg91
  // For now, just log it
  const message = getOTPMessage(otp, purpose);
  logger.info(`Sending OTP to ${phoneNumber}: ${message}`);
};

/**
 * Get OTP message based on purpose
 * @param otp OTP
 * @param purpose Purpose of OTP
 * @returns OTP message
 */
const getOTPMessage = (otp: string, purpose: OTPPurpose): string => {
  switch (purpose) {
    case 'registration':
      return `Your registration OTP is ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`;
    case 'login':
      return `Your login OTP is ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`;
    case 'reset-password':
      return `Your password reset OTP is ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`;
    default:
      return `Your OTP is ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`;
  }
}; 