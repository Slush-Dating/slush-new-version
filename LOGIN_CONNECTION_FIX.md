# Fix for Login Connection Issue on www.slushdating.com

## Problem
Unable to login via `www.slushdating.com/app`. Error: "Cannot connect to server at https://www.slushdating.com/api/auth"

## Root Cause
The nginx configuration was missing proper CORS headers for the `/api` proxy location, which can cause connection failures. Additionally, the backend server may not be running or nginx may not be properly configured.

## Solution

### Step 1: Update Nginx Configuration

The nginx config file has been updated with proper CORS headers. You need to upload it to your server:

```bash
# SSH into your VPS
ssh user@80.190.80.106

# Upload the updated nginx config
# (Copy nginx-config-www-slushdating-com.conf to your server)

# Copy to nginx sites-available
sudo cp nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com

# Test nginx configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx
```

### Step 2: Verify Backend Server is Running

```bash
# Check if backend is running
pm2 status

# If not running, start it
cd /root/slush-app/server
pm2 start index.js --name slush-server

# Check backend logs
pm2 logs slush-server
```

### Step 3: Test API Connection

```bash
# Test API directly (should work)
curl http://localhost:5001/api/events

# Test API through nginx (should work)
curl https://www.slushdating.com/api/events

# Test auth endpoint
curl -X POST https://www.slushdating.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Step 4: Check Nginx Error Logs

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log
```

## What Was Fixed

1. **Added CORS headers** to the `/api` location block in nginx config:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
   - `Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With`
   - Proper OPTIONS preflight handling

2. **Improved OPTIONS handling** with all necessary CORS headers

## Common Issues and Solutions

### Issue: 502 Bad Gateway
**Solution**: Backend server is not running
```bash
pm2 status
pm2 restart slush-server
```

### Issue: Connection refused
**Solution**: Backend server is not listening on port 5001
```bash
# Check if port 5001 is in use
sudo netstat -tlnp | grep 5001

# Check backend logs
pm2 logs slush-server
```

### Issue: SSL certificate errors
**Solution**: SSL certificate may need renewal
```bash
sudo certbot renew
sudo systemctl restart nginx
```

### Issue: nginx not proxying correctly
**Solution**: Check nginx configuration
```bash
sudo nginx -t
sudo systemctl status nginx
```

## Verification Checklist

- [ ] Backend server is running (`pm2 status`)
- [ ] Backend is accessible on port 5001 (`curl http://localhost:5001/api/events`)
- [ ] Nginx is running (`sudo systemctl status nginx`)
- [ ] Nginx config is valid (`sudo nginx -t`)
- [ ] API is accessible through nginx (`curl https://www.slushdating.com/api/events`)
- [ ] SSL certificate is valid
- [ ] No errors in nginx error log

## After Fixing

Once you've updated the nginx config and verified everything is running:

1. Clear browser cache
2. Try logging in again at `https://www.slushdating.com/app`
3. Check browser console (F12) for any remaining errors
4. Check network tab to see the actual API request/response

