import { StandardCheckoutClient, Env, StandardCheckoutPayRequest, MetaInfo, CreateSdkOrderRequest } from 'pg-sdk-node';
import { randomUUID } from 'crypto';
import { config } from '../config/config';
import { logger } from './logger';

// PhonePe client configuration
const CLIENT_ID = config.phonepe.clientId;
const CLIENT_SECRET = config.phonepe.clientSecret;
const CLIENT_VERSION = config.phonepe.clientVersion;
const ENVIRONMENT = config.phonepe.environment === 'PRODUCTION' ? Env.PRODUCTION : Env.PRODUCTION; // Only PRODUCTION is supported in the docs

// Initialize PhonePe client
let phonepeClient: any;

try {
  phonepeClient = StandardCheckoutClient.getInstance(
    CLIENT_ID,
    CLIENT_SECRET,
    CLIENT_VERSION,
    ENVIRONMENT
  );
  logger.info('PhonePe SDK client initialized successfully');
} catch (error) {
  logger.error('Failed to initialize PhonePe SDK client:', error);
}

/**
 * Generate PhonePe checkout URL
 * @param amount Amount in rupees (will be converted to paise)
 * @param redirectUrl Redirect URL after payment
 * @param metadata Additional metadata
 * @returns Checkout URL and order details
 */
export const generateCheckoutUrl = async (
  amount: number,
  redirectUrl: string,
  metadata: Record<string, string> = {}
): Promise<{ redirectUrl: string; orderId: string }> => {
  try {
    // Generate a unique merchant order ID
    const merchantOrderId = `ORDER_${Date.now()}_${randomUUID().substring(0, 8)}`;
    
    // Convert amount to paise (PhonePe requires amount in paise)
    const amountInPaise = Math.round(amount * 100);
    
    // Create metadata object
    const metaInfo = MetaInfo.builder();
    
    // Add metadata if provided
    Object.entries(metadata).forEach(([key, value]) => {
      if (key === 'udf1') metaInfo.udf1(value);
      if (key === 'udf2') metaInfo.udf2(value);
    });
    
    // Create payment request
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .metaInfo(metaInfo.build())
      .build();
    
    // Initiate payment
    const response = await phonepeClient.pay(request);
    
    logger.info(`PhonePe checkout URL generated for order ${merchantOrderId}`);
    
    return {
      redirectUrl: response.redirectUrl,
      orderId: merchantOrderId,
    };
  } catch (error: any) {
    logger.error(`PhonePe checkout URL generation failed: ${error.message}`);
    throw new Error(`Failed to generate PhonePe checkout URL: ${error.message}`);
  }
};

/**
 * Check payment status
 * @param merchantOrderId Merchant order ID
 * @returns Payment status
 */
export const checkPaymentStatus = async (merchantOrderId: string): Promise<any> => {
  try {
    // Get order status
    const response = await phonepeClient.getOrderStatus(merchantOrderId);
    
    logger.info(`PhonePe payment status checked for order ${merchantOrderId}: ${response.state}`);
    
    return response;
  } catch (error: any) {
    logger.error(`PhonePe payment status check failed: ${error.message}`);
    throw new Error(`Failed to check PhonePe payment status: ${error.message}`);
  }
};

/**
 * Verify webhook callback
 * @param username Username configured for callback
 * @param password Password configured for callback
 * @param authorization Authorization header from callback
 * @param responseBody Callback response body as string
 * @returns Callback response
 */
export const verifyWebhookCallback = (
  username: string,
  password: string,
  authorization: string,
  responseBody: string
): any => {
  try {
    const callbackResponse = phonepeClient.validateCallback(
      username,
      password,
      authorization,
      responseBody
    );
    
    logger.info(`PhonePe webhook callback verified for order ${callbackResponse.payload?.orderId || 'unknown'}`);
    
    return callbackResponse;
  } catch (error: any) {
    logger.error(`PhonePe webhook callback verification failed: ${error.message}`);
    throw new Error(`Failed to verify PhonePe webhook callback: ${error.message}`);
  }
};

/**
 * Create SDK order for mobile integration
 * @param amount Amount in rupees (will be converted to paise)
 * @param redirectUrl Redirect URL after payment
 * @returns Order token and details
 */
export const createSdkOrder = async (
  amount: number,
  redirectUrl: string
): Promise<{ token: string; orderId: string }> => {
  try {
    // Generate a unique merchant order ID
    const merchantOrderId = `ORDER_${Date.now()}_${randomUUID().substring(0, 8)}`;
    
    // Convert amount to paise (PhonePe requires amount in paise)
    const amountInPaise = Math.round(amount * 100);
    
    // Create SDK order request
    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .build();
    
    // Create SDK order
    const response = await phonepeClient.createSdkOrder(request);
    
    logger.info(`PhonePe SDK order created for order ${merchantOrderId}`);
    
    return {
      token: response.token,
      orderId: merchantOrderId,
    };
  } catch (error: any) {
    logger.error(`PhonePe SDK order creation failed: ${error.message}`);
    throw new Error(`Failed to create PhonePe SDK order: ${error.message}`);
  }
};

export default {
  generateCheckoutUrl,
  checkPaymentStatus,
  verifyWebhookCallback,
  createSdkOrder,
}; 