import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/config';
import { IUser } from '../models';
import { Token } from '../models/Token';
import { AppError } from '../utils/appError';

// Define token types
export type TokenType = 'access' | 'refresh';

// Define token payload
export interface TokenPayload {
  userId: string;
  role: string;
  type: TokenType;
}

/**
 * Generate JWT token
 * @param user User document
 * @param type Token type ('access' or 'refresh')
 * @returns Generated token
 */
export const generateToken = (user: IUser, type: TokenType): string => {
  const payload: TokenPayload = {
    userId: user._id ? user._id.toString() : '',
    role: user.role,
    type,
  };

  const secret = type === 'access' ? config.jwt.secret : config.jwt.refreshSecret;
  const expiresIn = type === 'access' ? config.jwt.expiresIn : config.jwt.refreshExpiresIn;

  // Cast to any to avoid TypeScript errors with jwt.sign
  return jwt.sign(payload, secret as any, { expiresIn } as any);
};

/**
 * Verify JWT token
 * @param token Token to verify
 * @param type Token type ('access' or 'refresh')
 * @returns Decoded token payload
 * @throws AppError if token is invalid
 */
export const verifyToken = (token: string, type: TokenType): TokenPayload => {
  try {
    const secret = type === 'access' ? config.jwt.secret : config.jwt.refreshSecret;
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    // Verify token type
    if (decoded.type !== type) {
      throw new AppError('Invalid token type', 401);
    }
    
    return decoded;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401);
    }
    
    throw new AppError('Invalid token', 401);
  }
};

/**
 * Save refresh token to database
 * @param userId User ID
 * @param token Refresh token
 * @param expiresIn Expiry time in seconds
 * @param deviceInfo Device information
 * @param ipAddress IP address
 */
export const saveRefreshToken = async (
  userId: string,
  token: string,
  expiresIn: string | number,
  deviceInfo: string,
  ipAddress: string,
): Promise<void> => {
  // Calculate expiry date
  const expirySeconds = typeof expiresIn === 'string'
    ? parseInt(expiresIn.replace(/\D/g, '')) * (expiresIn.includes('d') ? 86400 : expiresIn.includes('h') ? 3600 : 60)
    : expiresIn;
  
  const expiresAt = new Date(Date.now() + expirySeconds * 1000);
  
  // Save token to database
  await Token.create({
    userId,
    token,
    type: 'refresh',
    expiresAt,
    deviceInfo,
    ipAddress,
  });
};

/**
 * Verify refresh token from database
 * @param token Refresh token
 * @returns Token document if valid
 * @throws AppError if token is invalid or blacklisted
 */
export const verifyRefreshToken = async (token: string) => {
  const tokenDoc = await Token.findOne({ token, blacklisted: false });
  
  if (!tokenDoc) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  
  if (tokenDoc.expiresAt < new Date()) {
    await Token.deleteOne({ _id: tokenDoc._id });
    throw new AppError('Refresh token expired', 401);
  }
  
  return tokenDoc;
};

/**
 * Blacklist a refresh token
 * @param token Refresh token
 */
export const blacklistToken = async (token: string): Promise<void> => {
  await Token.updateOne({ token }, { blacklisted: true });
};

/**
 * Blacklist all refresh tokens for a user
 * @param userId User ID
 */
export const blacklistAllUserTokens = async (userId: string): Promise<void> => {
  await Token.updateMany({ userId }, { blacklisted: true });
}; 