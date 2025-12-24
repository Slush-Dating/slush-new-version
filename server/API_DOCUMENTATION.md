# API Documentation

## Swagger UI Access

The API documentation is available via Swagger UI at:

- **Production**: `https://www.slushdating.com/api-docs`
- **Staging**: `https://staging.slushdating.com/api-docs`
- **Local Development**: `http://localhost:5001/api-docs`

## Environment Differences

### Production vs Staging

**Important:** The API endpoints are **identical** for both production and staging environments. The only difference is the **database connection**:

- **Production**: Uses `MONGODB_URI` environment variable
- **Staging**: Uses `MONGODB_URI_STAGING` environment variable (when `NODE_ENV=staging` or `VITE_ENV=staging`)

### Base URLs

- **Production**: `https://www.slushdating.com/api`
- **Staging**: `https://staging.slushdating.com/api`
- **Local Development**: `http://localhost:5001/api`

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained from:
- `/api/auth/login` - Login endpoint
- `/api/auth/register` - Registration endpoint

Tokens expire after **7 days**.

## API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `PUT /onboarding` - Update onboarding data
- `GET /profile` - Get current user profile
- `GET /profile/:userId` - Get another user's profile
- `POST /upload` - Upload image/video files
- `POST /admin/login` - Admin login
- `POST /upgrade-mock` - Mock premium upgrade (testing)

### Events (`/api/events`)
- `GET /` - Get all events (upcoming by default)
- `GET /user/bookings` - Get user's bookings
- `GET /:id` - Get event by ID
- `GET /:id/participants` - Get event participants
- `POST /:id/book` - Book event ticket
- `DELETE /:id/book` - Cancel booking
- `GET /:id/booking-status` - Check booking status

### Matches (`/api/matches`)
- `POST /action` - Like, pass, or super like a user
- `GET /` - Get all matches
- `GET /liked-you` - Get users who liked you
- `GET /stats` - Get match statistics
- `POST /unmatch/:userId` - Unmatch with a user
- `POST /report/:userId` - Report a user
- `GET /check/:userId` - Check if users are matched

### Discovery (`/api/discovery`)
- `GET /feed` - Get discovery feed (potential matches)
- `GET /event-partners` - Get potential partners for an event

### Chat (`/api/chat`)
- `GET /` - Get chat list (all conversations)
- `GET /:matchId` - Get chat history for a match
- `POST /:matchId` - Send a message (also via Socket.IO)
- `POST /:matchId/read` - Mark messages as read
- `GET /unread` - Get total unread count
- `GET /unread/by-match` - Get unread counts by match

### Notifications (`/api/notifications`)
- `GET /` - Get all notifications
- `GET /unread-count` - Get unread notification count
- `POST /:id/read` - Mark notification as read
- `POST /read-all` - Mark all notifications as read
- `DELETE /:id` - Delete a notification

### Agora (`/api/agora`)
- `POST /token` - Generate Agora RTC token for video/audio
- `POST /event/:eventId/next-partner` - Get next partner for event session

### Admin (`/api/admin`)
- `GET /stats` - Get system statistics
- `GET /users` - Get all users (paginated)
- `GET /users/:userId` - Get user details
- `PUT /users/:userId/status` - Update user status
- `GET /events` - Get all events with statistics
- `GET /events/:eventId/stats` - Get event statistics
- `GET /reports` - Get all reports
- `PUT /reports/:reportId` - Update report status
- `GET /dashboard-stats` - Get comprehensive dashboard stats
- `POST /force-logout-all` - Force logout all users

## Socket.IO Events

The API also uses Socket.IO for real-time features. Connect to the same base URL (without `/api`) for WebSocket connections.

### Socket Events

**Client → Server:**
- `authenticate` - Authenticate socket connection with userId
- `join_chat` - Join a chat room for a match
- `send_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `join_event_session` - Join an event session
- `leave_event_session` - Leave an event session
- `get_user_status` - Get user online status

**Server → Client:**
- `authenticated` - Authentication confirmed
- `new_message` - New message received
- `chat_history` - Chat history sent
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `new_match` - New match created
- `new_notification` - New notification received
- `user_status_change` - User online/offline status changed
- `participant_count_update` - Event session participant count updated
- `partner_found` - Partner matched for event session

## Testing the API

### Using Swagger UI

1. Navigate to `/api-docs` on your server
2. Click "Authorize" button
3. Enter your JWT token: `Bearer <your-token>`
4. Test endpoints directly from the UI

### Using cURL

```bash
# Login
curl -X POST https://staging.slushdating.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get profile (with token)
curl -X GET https://staging.slushdating.com/api/auth/profile \
  -H "Authorization: Bearer <your-token>"
```

## Notes

- All file uploads support images (JPEG, PNG, WebP) and videos (MP4, MOV)
- Maximum file size: 2GB (videos are automatically cropped to 30 seconds)
- Video processing requires FFmpeg (check `/api/auth/health/ffmpeg`)
- Admin endpoints require admin authentication
- Premium features are gated by `isPremium` user flag

