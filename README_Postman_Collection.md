# Admin API Postman Collection

This Postman collection contains all the admin endpoints and health check for the server API.

## 📋 Collection Overview

The collection includes the following endpoints:

### Health Check
- **GET** `/health` - Server health check (public, no authentication required)

### Admin Endpoints (Require Authentication)
- **GET** `/admin/dashboard` - Get dashboard statistics (admin role required)
- **GET** `/admin/logs` - Get system logs (admin role required)
- **GET** `/admin/export/:type` - Export data (admin role required)
- **POST** `/admin` - Create a new admin (superadmin role required)
- **GET** `/admin` - Get all admins (superadmin role required)
- **GET** `/admin/:id` - Get admin by ID (superadmin role required)
- **PUT** `/admin/:id` - Update admin (superadmin role required)
- **DELETE** `/admin/:id` - Delete admin (superadmin role required)

## 🚀 Setup Instructions

### 1. Import the Collection
1. Open Postman
2. Click "Import" button
3. Select the `Admin_API_Collection.json` file
4. The collection will be imported with all endpoints

### 2. Configure Environment Variables

The collection uses the following environment variables that you need to set:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `baseUrl` | Your server base URL | `http://localhost:5000` |
| `adminToken` | JWT token for admin user | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `superadminToken` | JWT token for superadmin user | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `adminId` | ID of an admin for testing | `507f1f77bcf86cd799439011` |
| `exportType` | Type of data to export | `users`, `batches`, `payments`, `attendance` |
| `startDate` | Start date for export (YYYY-MM-DD) | `2024-01-01` |
| `endDate` | End date for export (YYYY-MM-DD) | `2024-12-31` |

### 3. Get Authentication Tokens

To get the required JWT tokens, you need to:

1. **For Admin Token**: Login with an admin account using the auth endpoints
2. **For Superadmin Token**: Login with a superadmin account using the auth endpoints

The tokens should be in the format: `Bearer <your_jwt_token>`

## 📝 API Details

### Health Check
```http
GET /health
```
- **Authentication**: None required
- **Response**: Server status information

### Admin Dashboard
```http
GET /api/admin/dashboard
```
- **Authentication**: Bearer token (admin role)
- **Response**: Dashboard statistics including user stats, batch stats, financial stats, and attendance stats

### System Logs
```http
GET /api/admin/logs
```
- **Authentication**: Bearer token (admin role)
- **Response**: System log files and content

### Export Data
```http
GET /api/admin/export/:type?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```
- **Authentication**: Bearer token (admin role)
- **Parameters**:
  - `type`: Type of data to export (`users`, `batches`, `payments`, `attendance`)
  - `startDate`: Start date (optional, defaults to start of current month)
  - `endDate`: End date (optional, defaults to current date)
- **Response**: JSON file download

### Create Admin
```http
POST /api/admin
```
- **Authentication**: Bearer token (superadmin role)
- **Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phoneNumber": "9876543210",
  "password": "Admin@123",
  "role": "admin"
}
```

### Get All Admins
```http
GET /api/admin
```
- **Authentication**: Bearer token (superadmin role)
- **Response**: List of all admin users

### Get Admin by ID
```http
GET /api/admin/:id
```
- **Authentication**: Bearer token (superadmin role)
- **Parameters**: `id` - Admin user ID
- **Response**: Admin user details

### Update Admin
```http
PUT /api/admin/:id
```
- **Authentication**: Bearer token (superadmin role)
- **Parameters**: `id` - Admin user ID
- **Body** (all fields optional):
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "phoneNumber": "9876543211",
  "password": "NewPassword@123"
}
```

### Delete Admin
```http
DELETE /api/admin/:id
```
- **Authentication**: Bearer token (superadmin role)
- **Parameters**: `id` - Admin user ID
- **Note**: Cannot delete your own account

## 🔐 Authentication Details

### JWT Token Format
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Role Requirements
- **Admin Role**: Required for dashboard, logs, and export endpoints
- **Superadmin Role**: Required for admin CRUD operations
- **No Authentication**: Health check endpoint

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

## 🧪 Testing Tips

1. **Start with Health Check**: Test the health endpoint first to ensure the server is running
2. **Test Authentication**: Verify your tokens work with a simple admin endpoint
3. **Use Environment Variables**: Update the variables in the collection for your specific setup
4. **Check Response Codes**: Monitor the response status codes for proper error handling
5. **Export Testing**: Test different export types and date ranges

## 🔧 Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check if your JWT token is valid and not expired
2. **403 Forbidden**: Ensure you have the correct role (admin vs superadmin)
3. **404 Not Found**: Verify the admin ID exists in the database
4. **400 Bad Request**: Check the request body format and validation rules

### Validation Rules

For admin creation/update, the following validation rules apply:
- `firstName`: Minimum 2 characters
- `lastName`: Minimum 2 characters
- `email`: Valid email format
- `phoneNumber`: Exactly 10 digits
- `password`: Minimum 8 characters with uppercase, lowercase, number, and special character

## 📁 File Structure

```
Admin_API_Collection.json    # Postman collection file
README_Postman_Collection.md # This documentation file
```

## 🤝 Support

If you encounter any issues with the API or collection:
1. Check the server logs for detailed error messages
2. Verify your authentication tokens are valid
3. Ensure you have the correct permissions for the endpoints
4. Check the request/response format matches the documentation 