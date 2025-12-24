import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Slush Dating API',
      version: '1.0.0',
      description: `
# Slush Dating API Documentation

## Environment Configuration

### Production vs Staging

**IMPORTANT:** The API endpoints are identical for both production and staging environments. The only difference is the **database connection**:

- **Production**: Uses \`MONGODB_URI\` environment variable
- **Staging**: Uses \`MONGODB_URI_STAGING\` environment variable (when \`NODE_ENV=staging\` or \`VITE_ENV=staging\`)

### Base URLs

- **Production**: \`https://www.slushdating.com/api\`
- **Staging**: \`https://staging.slushdating.com/api\`
- **Local Development**: \`http://localhost:5001/api\`

### Authentication

Most endpoints require authentication via JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are obtained from the \`/api/auth/login\` or \`/api/auth/register\` endpoints and expire after 7 days.

## Socket.IO Events

The API also uses Socket.IO for real-time features. Connect to the same base URL (without /api) for WebSocket connections.
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'https://www.slushdating.com/api',
        description: 'Production Server',
      },
      {
        url: 'https://staging.slushdating.com/api',
        description: 'Staging Server',
      },
      {
        url: 'http://localhost:5001/api',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            dob: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['man', 'woman', 'non-binary', 'other'] },
            interestedIn: { type: 'string', enum: ['men', 'women', 'everyone'] },
            bio: { type: 'string' },
            photos: { type: 'array', items: { type: 'string' } },
            videos: { type: 'array', items: { type: 'string' } },
            interests: { type: 'array', items: { type: 'string' } },
            locationString: { type: 'string' },
            onboardingCompleted: { type: 'boolean' },
            isPremium: { type: 'boolean' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            location: { type: 'string' },
            imageUrl: { type: 'string' },
            description: { type: 'string' },
            eventType: { type: 'string', enum: ['straight', 'gay', 'bisexual'] },
            minAge: { type: 'number' },
            maxAge: { type: 'number' },
            maxMaleParticipants: { type: 'number' },
            maxFemaleParticipants: { type: 'number' },
            maleCount: { type: 'number' },
            femaleCount: { type: 'number' },
            otherCount: { type: 'number' },
            status: { type: 'string' },
            isPasswordProtected: { type: 'boolean' },
          },
        },
        Match: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            age: { type: 'number' },
            imageUrl: { type: 'string' },
            bio: { type: 'string' },
            matchedAt: { type: 'string', format: 'date-time' },
            context: { type: 'string' },
            isNew: { type: 'boolean' },
            isSuperLike: { type: 'boolean' },
            lastMessage: { type: 'object' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            matchId: { type: 'string' },
            senderId: { type: 'string' },
            receiverId: { type: 'string' },
            content: { type: 'string' },
            messageType: { type: 'string', enum: ['text', 'image', 'video'] },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            readAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['like', 'match', 'general', 'security'] },
            title: { type: 'string' },
            description: { type: 'string' },
            userImage: { type: 'string' },
            matchId: { type: 'string' },
            fromUserId: { type: 'string' },
            isRead: { type: 'boolean' },
            timestamp: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './index.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

