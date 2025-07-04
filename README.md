# Educational Institution Management Server

A comprehensive backend server for managing educational institutions, built with Node.js, Express, TypeScript, and MongoDB.

## Features

- **Authentication System**
  - JWT-based authentication with refresh tokens
  - OTP-based verification via SMS and email
  - Role-based access control (User, Admin, SuperAdmin)

- **User Management**
  - Profile management
  - Role management
  - Batch assignment

- **Batch Management**
  - Create and manage batches
  - Assign students to batches
  - Track batch progress

- **Attendance System**
  - Face recognition-based attendance
  - Check-in/check-out functionality
  - Attendance reports

- **Payment Processing**
  - PhonePe integration for online payments
  - Payment verification and receipts
  - Payment history tracking

- **Service Management**
  - Create and manage services
  - Assign services to batches

- **Media Handling**
  - Cloudinary integration for image storage
  - Profile image management

## Technology Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, OTP
- **File Storage**: Cloudinary
- **Payment Gateway**: PhonePe Business API
- **Email**: Nodemailer
- **PDF Generation**: pdf-lib
- **Logging**: Winston

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Start the development server:
   ```
   npm run dev
   ```

## PhonePe Integration

This project uses the PhonePe Payment Gateway SDK for Node.js to process payments. The integration includes:

- Checkout page generation
- Payment status verification
- Webhook handling for real-time payment updates
- SDK order creation for mobile integration

### PhonePe Configuration

To configure PhonePe, add the following to your `.env` file:

```
PHONEPE_CLIENT_ID=your_client_id
PHONEPE_CLIENT_SECRET=your_client_secret
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENVIRONMENT=PRODUCTION
PHONEPE_WEBHOOK_USERNAME=your_webhook_username
PHONEPE_WEBHOOK_PASSWORD=your_webhook_password
```

### Payment Flow

1. User initiates payment
2. Server generates PhonePe checkout URL
3. User completes payment on PhonePe
4. PhonePe sends webhook notification
5. Server verifies payment and updates status
6. Payment receipt is generated

## API Documentation

### Authentication Routes

- `POST /api/auth/register` - Register a new user (Step 1)
- `POST /api/auth/verify-registration` - Verify OTP and complete registration (Step 2)
- `POST /api/auth/login` - Login with phone number (Step 1)
- `POST /api/auth/verify-login` - Verify OTP and complete login (Step 2)
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/register-super-admin` - Register a super admin (one-time setup)
- `POST /api/auth/login-with-password` - Login with email and password (for admin/superadmin)

### User Routes

- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `PUT /api/users/me/password` - Update password

### Admin Routes

- `GET /api/admin/users` - Get all users (Admin only)
- `GET /api/admin/users/:id` - Get user by ID (Admin only)
- `PUT /api/admin/users/:id` - Update user (Admin only)
- `DELETE /api/admin/users/:id` - Delete user (Admin only)

### Batch Routes

- `GET /api/batches` - Get all batches
- `GET /api/batches/:id` - Get batch by ID
- `POST /api/batches` - Create new batch (Admin only)
- `PUT /api/batches/:id` - Update batch (Admin only)
- `DELETE /api/batches/:id` - Delete batch (Admin only)

### Attendance Routes

- `POST /api/attendance/check-in` - Check-in attendance
- `POST /api/attendance/check-out` - Check-out attendance
- `GET /api/attendance/me` - Get current user attendance
- `GET /api/attendance/report` - Get attendance report (Admin only)

### Payment Routes

- `POST /api/payments/initiate` - Initiate payment
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - PhonePe webhook handler

### Service Routes

- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create new service (Admin only)
- `PUT /api/services/:id` - Update service (Admin only)
- `DELETE /api/services/:id` - Delete service (Admin only)

## License

This project is licensed under the ISC License. 