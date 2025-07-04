# Payment Status API Documentation

## Overview
After payment completion, users are redirected to `https://swrzee.in/check-status` instead of directly to the server verification endpoint. The frontend can then use these API endpoints to check payment status.

## New API Endpoints

### 1. Check Payment Status by Payment ID
**Endpoint:** `GET /api/payments/status/:paymentId`  
**Access:** Public  
**Description:** Check payment status using the payment ID

**Example Request:**
```javascript
// Frontend JavaScript
const checkPaymentStatus = async (paymentId) => {
  try {
    const response = await fetch(`/api/payments/status/${paymentId}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Payment Status:', data.data.status);
      console.log('Payment Details:', data.data);
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
  }
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "507f1f77bcf86cd799439011",
    "merchantOrderId": "ORDER_1234567890_abc12345",
    "amount": 1000,
    "status": "success",
    "paymentMethod": "phonepe",
    "paymentDate": "2024-01-15T10:30:00.000Z",
    "failureReason": "",
    "receiptUrl": "https://cloudinary.com/receipt.pdf",
    "user": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890"
    },
    "batch": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Batch 2024",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }
}
```

### 2. Check Payment Status by Merchant Order ID
**Endpoint:** `GET /api/payments/status/order/:merchantOrderId`  
**Access:** Public  
**Description:** Check payment status using the merchant order ID (PhonePe order ID)

**Example Request:**
```javascript
// Frontend JavaScript
const checkPaymentStatusByOrderId = async (merchantOrderId) => {
  try {
    const response = await fetch(`/api/payments/status/order/${merchantOrderId}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Payment Status:', data.data.status);
      console.log('Payment Details:', data.data);
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
  }
};
```

## Frontend Implementation Example

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

const PaymentStatusPage = () => {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get payment ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('paymentId');
    const merchantOrderId = urlParams.get('merchantOrderId');

    if (paymentId) {
      checkPaymentStatus(paymentId);
    } else if (merchantOrderId) {
      checkPaymentStatusByOrderId(merchantOrderId);
    } else {
      setError('No payment ID or merchant order ID provided');
      setLoading(false);
    }
  }, []);

  const checkPaymentStatus = async (paymentId) => {
    try {
      const response = await fetch(`/api/payments/status/${paymentId}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus(data.data);
      } else {
        setError('Failed to fetch payment status');
      }
    } catch (error) {
      setError('Error checking payment status');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatusByOrderId = async (merchantOrderId) => {
    try {
      const response = await fetch(`/api/payments/status/order/${merchantOrderId}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus(data.data);
      } else {
        setError('Failed to fetch payment status');
      }
    } catch (error) {
      setError('Error checking payment status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Checking payment status...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!paymentStatus) {
    return <div>Payment not found</div>;
  }

  return (
    <div className="payment-status">
      <h1>Payment Status</h1>
      
      <div className="status-card">
        <h2>Status: {paymentStatus.status.toUpperCase()}</h2>
        
        <div className="payment-details">
          <p><strong>Amount:</strong> ₹{paymentStatus.amount}</p>
          <p><strong>Payment Method:</strong> {paymentStatus.paymentMethod}</p>
          <p><strong>Order ID:</strong> {paymentStatus.merchantOrderId}</p>
          
          {paymentStatus.paymentDate && (
            <p><strong>Payment Date:</strong> {new Date(paymentStatus.paymentDate).toLocaleString()}</p>
          )}
          
          {paymentStatus.failureReason && (
            <p><strong>Failure Reason:</strong> {paymentStatus.failureReason}</p>
          )}
          
          {paymentStatus.receiptUrl && (
            <a href={paymentStatus.receiptUrl} target="_blank" rel="noopener noreferrer">
              Download Receipt
            </a>
          )}
        </div>
        
        {paymentStatus.user && (
          <div className="user-details">
            <h3>User Details</h3>
            <p><strong>Name:</strong> {paymentStatus.user.name}</p>
            <p><strong>Email:</strong> {paymentStatus.user.email}</p>
            <p><strong>Phone:</strong> {paymentStatus.user.phone}</p>
          </div>
        )}
        
        {paymentStatus.batch && (
          <div className="batch-details">
            <h3>Batch Details</h3>
            <p><strong>Batch Name:</strong> {paymentStatus.batch.name}</p>
            <p><strong>Start Date:</strong> {paymentStatus.batch.startDate}</p>
            <p><strong>End Date:</strong> {paymentStatus.batch.endDate}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatusPage;
```

## Payment Status Values

- **`pending`**: Payment is being processed
- **`success`**: Payment completed successfully
- **`failed`**: Payment failed
- **`rejected`**: Payment was rejected by admin

## URL Parameters for Frontend

When PhonePe redirects to your frontend, you can extract payment information from URL parameters:

```javascript
// Example URL: https://swrzee.in/check-status?paymentId=507f1f77bcf86cd799439011
// or: https://swrzee.in/check-status?merchantOrderId=ORDER_1234567890_abc12345

const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('paymentId');
const merchantOrderId = urlParams.get('merchantOrderId');
```

## Auto-refresh for Pending Payments

For pending payments, you might want to implement auto-refresh:

```javascript
const checkStatusWithRetry = async (paymentId, maxRetries = 10) => {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`/api/payments/status/${paymentId}`);
    const data = await response.json();
    
    if (data.success && data.data.status !== 'pending') {
      return data.data;
    }
    
    // Wait 3 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  throw new Error('Payment status check timeout');
};
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `404`: Payment not found
- `500`: Internal server error

Always handle errors gracefully in your frontend implementation. 