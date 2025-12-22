# API Connection Fix for www.slushdating.com

## Issue Identified

When trying to login or create an account at `www.slushdating.com/api/auth`, the connection was failing because nginx was incorrectly proxying API requests.

### Root Cause

The nginx configuration had:
```nginx
location /api {
    proxy_pass http://localhost:5001;
}
```

This configuration strips the `/api` prefix when proxying. So when a request comes to `/api/auth/login`, nginx was forwarding it to `http://localhost:5001/auth/login` instead of `http://localhost:5001/api/auth/login`.

However, the backend server expects routes at `/api/auth/login` (as defined in `server/index.js` with `app.use('/api/auth', authRoutes)`).

## Fix Applied

Updated both nginx configuration files to preserve the `/api` prefix:

```nginx
location /api {
    proxy_pass http://localhost:5001/api;
}
```

Now when a request comes to `/api/auth/login`, nginx correctly forwards it to `http://localhost:5001/api/auth/login`.

## Files Updated

1. ✅ `nginx-config-www-slushdating-com.conf` - Fixed `/api` proxy_pass
2. ✅ `nginx-config-slushdating-com.conf` - Fixed `/api` proxy_pass  
3. ✅ `src/services/authService.ts` - Enhanced error handling and debugging

## Deployment Steps

To apply these fixes on your VPS:

1. **Upload the updated nginx config files to your VPS:**
   ```bash
   # Copy the updated config to your VPS
   scp nginx-config-www-slushdating-com.conf user@your-vps:/tmp/
   ```

2. **SSH into your VPS:**
   ```bash
   ssh user@your-vps-ip
   ```

3. **Backup current config:**
   ```bash
   sudo cp /etc/nginx/sites-available/www-slushdating-com /etc/nginx/sites-available/www-slushdating-com.backup
   ```

4. **Update nginx config:**
   ```bash
   sudo cp /tmp/nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com
   ```

5. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

6. **If test passes, reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

7. **Verify the backend is running:**
   ```bash
   pm2 status
   # Should show slush-server running
   
   # Test backend directly
   curl http://localhost:5001/api/events
   ```

8. **Test the API endpoint:**
   ```bash
   curl -X POST https://www.slushdating.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

## Enhanced Error Handling

The authentication service now includes:
- Better error messages for 502 Bad Gateway errors
- Better error messages for 504 Gateway Timeout errors
- Detailed logging of API URLs, hostname, and protocol
- More helpful connection error messages

## Verification Checklist

After deploying, verify:

- [ ] Backend server is running (`pm2 status`)
- [ ] Nginx is running (`sudo systemctl status nginx`)
- [ ] Nginx config test passes (`sudo nginx -t`)
- [ ] Direct backend test works (`curl http://localhost:5001/api/events`)
- [ ] API endpoint accessible via nginx (`curl https://www.slushdating.com/api/events`)
- [ ] Login form shows correct API URL in browser console
- [ ] Login/register requests succeed

## Troubleshooting

If issues persist after applying the fix:

1. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Check backend logs:**
   ```bash
   pm2 logs slush-server
   ```

3. **Verify backend is accessible:**
   ```bash
   curl http://localhost:5001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}'
   ```

4. **Check nginx access logs:**
   ```bash
   sudo tail -f /var/log/nginx/access.log
   ```

5. **Verify SSL certificate:**
   ```bash
   sudo certbot certificates
   ```

## Additional Notes

- The frontend API configuration (`src/services/apiConfig.ts`) is correct and doesn't need changes
- The backend routes are correctly set up at `/api/auth/*`
- The issue was purely in the nginx proxy configuration
- Enhanced error messages will help diagnose any future connection issues

