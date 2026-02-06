# GeoShield AI - Backend Server

## Overview
GeoShield AI is a comprehensive landslide prevention and risk assessment system. This backend server provides RESTful APIs for user management, real-time predictions, weather integration, alerts, and historical incident tracking.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Logging**: Winston

## Project Structure
```
server/
├── src/
│   ├── app.js                  # Main application entry point
│   ├── controllers/            # Request handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── predictionController.js
│   │   ├── alertController.js
│   │   ├── weatherController.js
│   │   ├── incidentController.js
│   │   └── adminController.js
│   ├── routes/                 # API route definitions
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── predictions.js
│   │   ├── alerts.js
│   │   ├── weather.js
│   │   ├── incidents.js
│   │   └── admin.js
│   ├── models/                 # MongoDB schemas
│   │   ├── User.js
│   │   ├── Prediction.js
│   │   └── HistoricalIncident.js
│   ├── middleware/             # Custom middleware
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── services/               # Business logic services
│   │   ├── alertService.js
│   │   └── weatherService.js
│   ├── utils/                  # Utility functions
│   │   ├── logger.js
│   │   ├── api_error.js
│   │   └── async_handler.js
│   └── init/                   # Initialization scripts
│       ├── index.js
│       └── data.js
└── package.json
```

## Environment Variables
Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/geoshield

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# ML Service
ML_SERVICE_URL=http://localhost:8001

# Weather API (OpenWeatherMap)
WEATHER_API_KEY=your_openweathermap_api_key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Alert Services (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
SENDGRID_API_KEY=your_sendgrid_key
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Steps
1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with required environment variables

4. Start MongoDB service:
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

5. Run the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /signup` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user
- `PUT /password` - Update password
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password
- `POST /logout` - Logout user
- `POST /verify-token` - Verify JWT token

### Users (`/api/users`)
- `GET /me` - Get current user profile
- `PUT /me` - Update current user profile
- `DELETE /me` - Delete current user account
- `GET /` - Get all users (Admin)
- `GET /stats` - Get user statistics (Admin)
- `GET /:id` - Get user by ID (Admin)
- `PUT /:id` - Update user (Admin)
- `DELETE /:id` - Delete user (Admin)

### Predictions (`/api/predictions`)
- `POST /single` - Get single location prediction
- `POST /batch` - Get batch predictions
- `POST /store` - Store prediction result
- `POST /route` - Analyze route for landslide risk
- `GET /active` - Get active predictions for map
- `GET /nearby` - Get predictions near location
- `GET /stats` - Get prediction statistics
- `GET /:id` - Get prediction by ID
- `DELETE /cleanup` - Cleanup old predictions (Admin)

### Alerts (`/api/alerts`)
- `GET /` - Get user's alert history
- `POST /test` - Send test alert
- `POST /create` - Create new alert
- `PUT /:id/read` - Mark alert as read
- `DELETE /:id` - Delete alert
- `GET /preferences` - Get alert preferences
- `PUT /preferences` - Update alert preferences
- `GET /stats` - Get alert statistics

### Weather (`/api/weather`)
- `GET /current` - Get current weather
- `GET /forecast` - Get weather forecast
- `GET /alerts` - Get weather alerts
- `GET /historical` - Get historical weather data
- `GET /risk` - Get weather-based risk assessment

### Incidents (`/api/incidents`)
- `GET /` - Get all historical incidents
- `GET /nearby` - Get incidents near location
- `GET /stats` - Get incident statistics
- `GET /:id` - Get incident by ID
- `POST /` - Create new incident (Admin)
- `PUT /:id` - Update incident (Admin)
- `DELETE /:id` - Delete incident (Admin)

### Admin (`/api/admin`)
- `GET /dashboard` - Get dashboard statistics
- `GET /health` - Get system health metrics
- `GET /logs` - Get activity logs
- `GET /export` - Export data (JSON/CSV)
- `DELETE /cleanup` - Cleanup old data (Super Admin)
- `PUT /settings` - Update system settings (Super Admin)

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### User Roles
- `user` - Regular user (default)
- `analyst` - Data analyst
- `admin` - Administrator
- `super_admin` - Super administrator

## Error Handling

The API uses standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

Error response format:
```json
{
  "success": false,
  "error": "Error message",
  "details": {}
}
```

## Data Models

### User
- name, email, password (hashed)
- role, location, alertPreferences
- createdAt, updatedAt

### Prediction
- location (GeoJSON Point)
- riskLevel (Low, Moderate, High, Severe)
- probability (0-100)
- features, metadata
- createdAt, expiresAt

### Historical Incident
- location (GeoJSON Point)
- date, severity, description
- casualties, damage
- verified, reportedBy

## Testing

Run tests:
```bash
npm test
```

## Logging

Logs are stored in `server/logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## Health Check

Check server health:
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "service": "GeoShield AI Backend",
  "version": "1.0.0",
  "timestamp": "2026-01-27T...",
  "uptime": 123.45,
  "environment": "development"
}
```

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Role-based access control (RBAC)
- Request validation
- CORS protection
- Rate limiting (TODO)
- Helmet.js for security headers (TODO)

## Performance Optimization

- MongoDB indexes on frequently queried fields
- Geospatial indexes for location queries
- Connection pooling
- Request payload size limits
- Async/await error handling

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [repository-url]
- Email: support@geoshield.ai

## Changelog

### Version 1.0.0 (2026-01-27)
- Complete backend implementation
- All controllers and routes
- Authentication and authorization
- Prediction and weather integration
- Alert system
- Historical incident tracking
- Admin panel APIs
