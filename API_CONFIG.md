# API Configuration Guide

## Simple Setup

The API configuration is now simplified:

- **Development**: Always uses `http://localhost:5001`
- **Production**: Uses the IP address you're accessing from (or set via environment variable)

## How It Works

### Development Mode
When running `npm run dev`, the app automatically connects to:
```
http://localhost:5001/api
```

### Production Mode
When accessing the built app (from `dist` folder):
- If you access via IP address (e.g., `http://192.168.1.100:5175`), it will use that IP
- API will be: `http://192.168.1.100:5001/api`

## Setting Production IP Manually

If you need to set a specific IP address for production builds, create a `.env.production` file:

```bash
# .env.production
VITE_PRODUCTION_API_HOST=192.168.1.100
```

Then rebuild:
```bash
npm run build
```

## For TestFlight (Mobile Apps)

When building for mobile, you can set the production IP:

1. Create `.env.production`:
```bash
VITE_PRODUCTION_API_HOST=YOUR_SERVER_IP
```

2. Build and sync:
```bash
npm run build
npx cap sync
```

The mobile app will connect to `http://YOUR_SERVER_IP:5001/api`

## Notes

- The backend server must be running on port 5001
- For production, ensure your server allows connections from the network
- The app automatically detects if you're accessing via IP address and uses that


