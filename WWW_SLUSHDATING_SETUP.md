# Setup Guide for www.slushdating.com Proxies

This guide sets up nginx on your VPS to handle `www.slushdating.com` with proxies for admin, api, and app.

## Overview

The setup provides:
- **`/admin`** → Redirects to `/app/admin` (React Router handles the admin route)
- **`/api`** → Proxies to backend API (localhost:5001)
- **`/app`** → Serves the React frontend application
- **`/socket.io`** → Proxies WebSocket connections to backend
- **`/uploads`** → Proxies media files from backend

## Prerequisites

- VPS IP: `80.190.80.106`
- Domain: `www.slushdating.com` pointing to your VPS
- SSL certificate for `www.slushdating.com`
- React app built and deployed to `/root/slush-app/dist`
- Backend server running on `localhost:5001`

## Step 1: Copy Nginx Configuration

1. **SSH into your VPS**:
   ```bash
   ssh user@80.190.80.106
   ```

2. **Copy the nginx configuration**:
   ```bash
   # Upload nginx-config-www-slushdating-com.conf to your VPS
   # Then copy it to nginx sites-available
   sudo cp nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com
   ```

   Or manually create/edit the file:
   ```bash
   sudo nano /etc/nginx/sites-available/www-slushdating-com
   ```
   
   Then paste the contents from `nginx-config-www-slushdating-com.conf`.

## Step 2: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -sf /etc/nginx/sites-available/www-slushdating-com /etc/nginx/sites-enabled/

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default
```

## Step 3: Get SSL Certificate

```bash
# Get SSL certificate for www.slushdating.com
sudo certbot --nginx -d www.slushdating.com -d slushdating.com --non-interactive --agree-tos --email your-email@example.com
```

**Note**: Make sure DNS is configured and propagated before running certbot.

## Step 4: Test and Restart Nginx

```bash
# Test nginx configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

## Step 5: Verify Everything Works

Test these URLs:

```bash
# Test API
curl https://www.slushdating.com/api/events

# Test app
curl -I https://www.slushdating.com/app/

# Test admin (should redirect to /app/admin)
curl -I https://www.slushdating.com/admin

# Test socket.io
curl https://www.slushdating.com/socket.io/
```

## How It Works

### `/api` Proxy
- All requests to `https://www.slushdating.com/api/*` are proxied to `http://localhost:5001/api/*`
- Includes proper CORS headers
- Handles WebSocket upgrades

### `/app` Frontend
- Serves the React app from `/root/slush-app/dist`
- React Router handles all client-side routing
- Static assets are cached for 1 year

### `/admin` Route
- Redirects to `/app/admin`
- React Router handles the `/admin` route within the app
- This ensures assets load correctly since the app is built with base `/app/`

### `/socket.io` Proxy
- Proxies WebSocket connections to the backend
- Required for real-time features (chat, notifications)

### `/uploads` Proxy
- Serves media files from the backend
- Files are cached for 1 year

## Troubleshooting

### Problem: 502 Bad Gateway
**Solution**: 
1. Check if backend is running: `pm2 status`
2. Check backend logs: `pm2 logs slush-server`
3. Test backend directly: `curl http://localhost:5001/api/events`

### Problem: SSL certificate error
**Solution**: 
1. Ensure DNS is configured correctly
2. Wait for DNS propagation (can take up to 48 hours)
3. Run certbot again: `sudo certbot --nginx -d www.slushdating.com -d slushdating.com`

### Problem: Assets not loading on `/admin`
**Solution**: 
- The `/admin` route redirects to `/app/admin` to ensure assets load correctly
- This is expected behaviour since the app is built with base `/app/`

### Problem: CORS errors
**Solution**: 
- Check that CORS headers are set correctly in the nginx config
- Verify requests are going through nginx (not directly to backend)

### Problem: WebSocket not connecting
**Solution**: 
1. Verify the `/socket.io/` location block is present
2. Check that backend Socket.IO is running
3. Test direct connection: `curl https://www.slushdating.com/socket.io/`

## Configuration Files

- **Nginx config**: `/etc/nginx/sites-available/www-slushdating-com`
- **React app**: `/root/slush-app/dist`
- **Backend**: `/root/slush-app/server`

## Useful Commands

```bash
# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx

# Test nginx config
sudo nginx -t

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# View nginx access logs
sudo tail -f /var/log/nginx/access.log

# Restart backend
pm2 restart slush-server

# View backend logs
pm2 logs slush-server
```

## Next Steps

After setup:
1. Test all routes (`/admin`, `/api`, `/app`)
2. Verify WebSocket connections work
3. Test file uploads/downloads
4. Monitor logs for any issues

---

**That's it!** Your proxies are now set up and ready to use. 🎉

