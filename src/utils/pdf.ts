import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import dayjs from 'dayjs';

/**
 * Generate a payment receipt PDF
 * @param data Receipt data
 * @returns PDF buffer
 */
export const generateReceipt = async (data: {
  receiptNumber: string;
  date: Date;
  userName: string;
  userEmail: string;
  userPhone: string;
  batchName: string;
  amount: number;
  transactionId: string;
  paymentMethod: string;
  status: string;
}): Promise<Buffer> => {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page to the document
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set page margins
    const margin = 50;
    const width = page.getWidth() - 2 * margin;
    
    // Draw header
    page.drawText('PAYMENT RECEIPT', {
      x: margin,
      y: page.getHeight() - margin,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    
    // Draw receipt number and date
    page.drawText(`Receipt #: ${data.receiptNumber}`, {
      x: margin,
      y: page.getHeight() - margin - 40,
      size: 12,
      font: helveticaBold,
    });
    
    page.drawText(`Date: ${dayjs(data.date).format('DD/MM/YYYY HH:mm')}`, {
      x: margin + width - 180,
      y: page.getHeight() - margin - 40,
      size: 12,
      font: helveticaFont,
    });
    
    // Draw horizontal line
    page.drawLine({
      start: { x: margin, y: page.getHeight() - margin - 60 },
      end: { x: margin + width, y: page.getHeight() - margin - 60 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Draw customer information
    page.drawText('Customer Information:', {
      x: margin,
      y: page.getHeight() - margin - 90,
      size: 14,
      font: helveticaBold,
    });
    
    page.drawText(`Name: ${data.userName}`, {
      x: margin,
      y: page.getHeight() - margin - 120,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Email: ${data.userEmail}`, {
      x: margin,
      y: page.getHeight() - margin - 140,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Phone: ${data.userPhone}`, {
      x: margin,
      y: page.getHeight() - margin - 160,
      size: 12,
      font: helveticaFont,
    });
    
    // Draw payment information
    page.drawText('Payment Information:', {
      x: margin,
      y: page.getHeight() - margin - 200,
      size: 14,
      font: helveticaBold,
    });
    
    page.drawText(`Batch: ${data.batchName}`, {
      x: margin,
      y: page.getHeight() - margin - 230,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Amount: Rs. ${(data.amount / 100).toFixed(2)}`, {
      x: margin,
      y: page.getHeight() - margin - 250,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Transaction ID: ${data.transactionId}`, {
      x: margin,
      y: page.getHeight() - margin - 270,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Payment Method: ${data.paymentMethod}`, {
      x: margin,
      y: page.getHeight() - margin - 290,
      size: 12,
      font: helveticaFont,
    });
    
    page.drawText(`Status: ${data.status}`, {
      x: margin,
      y: page.getHeight() - margin - 310,
      size: 12,
      font: helveticaBold,
      color: data.status === 'success' ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0),
    });
    
    // Draw horizontal line
    page.drawLine({
      start: { x: margin, y: page.getHeight() - margin - 340 },
      end: { x: margin + width, y: page.getHeight() - margin - 340 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Draw footer
    page.drawText('Thank you for your payment!', {
      x: margin + width / 2 - 80,
      y: page.getHeight() - margin - 370,
      size: 12,
      font: helveticaBold,
    });
    
    page.drawText('This is a computer-generated receipt and does not require a signature.', {
      x: margin + width / 2 - 180,
      y: page.getHeight() - margin - 390,
      size: 10,
      font: helveticaFont,
    });
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Return PDF buffer
    return Buffer.from(pdfBytes);
  } catch (error: any) {
    logger.error(`Failed to generate receipt PDF: ${error.message}`);
    throw new Error(`Failed to generate receipt PDF: ${error.message}`);
  }
};

/**
 * Save PDF to file
 * @param pdfBuffer PDF buffer
 * @param fileName File name
 * @returns File path
 */
export const savePdfToFile = (pdfBuffer: Buffer, fileName: string): string => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads/receipts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Save PDF to file
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    
    logger.info(`PDF saved to ${filePath}`);
    
    return filePath;
  } catch (error: any) {
    logger.error(`Failed to save PDF to file: ${error.message}`);
    throw new Error(`Failed to save PDF to file: ${error.message}`);
  }
}; 