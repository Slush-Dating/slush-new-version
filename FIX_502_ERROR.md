# Fixing 502 Bad Gateway Error

## Problem
When accessing the app from a production server, you're getting a `502 Bad Gateway` error when trying to login. This means nginx is receiving the request but cannot forward it to the backend server.

## Common Causes

1. **Backend server not running** on the production server
2. **nginx not configured** to proxy `/api` requests to the backend
3. **Wrong API URL** in the frontend build
4. **Backend server not listening** on the correct port (5001)

## Solutions

### Solution 1: Set Production API URL (Recommended)

Before building for production, create a `.env.production` file in the project root:

```bash
# .env.production
VITE_PRODUCTION_API_URL=https://your-production-domain.com
```

Replace `your-production-domain.com` with your actual production domain.

Then rebuild:
```bash
npm run build
```

### Solution 2: Verify Backend is Running

On your production server, check if the backend is running:

```bash
# Check if Node.js server is running on port 5001
lsof -i :5001

# Or check with pm2
pm2 status

# Check server logs
pm2 logs slush-server
```

If not running, start it:
```bash
cd ~/slush-app/server
pm2 start index.js --name slush-server
# Or if using nodemon
npm start
```

### Solution 3: Verify nginx Configuration

Check if nginx is configured to proxy `/api` requests:

```bash
# Test nginx configuration
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log
```

Your nginx config should include:

```nginx
location /api {
    proxy_pass http://localhost:5001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Solution 4: Check Server Connectivity

Test if the backend is accessible:

```bash
# From the server itself
curl http://localhost:5001/api/events

# Should return JSON (or empty array)
```

If this fails, the backend isn't running or isn't accessible.

### Solution 5: Check Browser Console

Open your browser's developer console and look for:
- The API URL being used (should show in console logs)
- Any CORS errors
- Network tab showing the actual request URL

The console will now show:
```
🔗 API Base URL: https://your-domain.com/api
📍 Environment: { ... }
```

## Quick Checklist

- [ ] Backend server is running (`pm2 status` or `lsof -i :5001`)
- [ ] nginx is running (`sudo systemctl status nginx`)
- [ ] nginx config includes `/api` proxy to `http://localhost:5001`
- [ ] `.env.production` file exists with `VITE_PRODUCTION_API_URL`
- [ ] Frontend has been rebuilt after setting environment variables
- [ ] Backend is listening on `0.0.0.0:5001` (not just `localhost`)

## Testing

After fixing, test the connection:

```bash
# Test API endpoint directly
curl https://your-domain.com/api/events

# Should return JSON without 502 error
```

## For TestFlight

When building for TestFlight, make sure:

1. Create `.env.production` with your production domain
2. Build: `npm run build`
3. Sync: `npx cap sync`
4. The production server backend is running and accessible

The app will use the `VITE_PRODUCTION_API_URL` environment variable when built for production.


