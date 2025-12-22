# Fix for White Screen on www.slushdating.com/app

## Problem
The app shows a white screen because nginx isn't serving JavaScript and CSS assets correctly.

## Root Cause
The nginx configuration was missing a proper location block for static assets (`/app/assets/*`), causing 404 errors for JavaScript and CSS files.

## Solution

### Option 1: Quick Fix Script (Recommended)

1. **Upload the fixed config file to your VPS:**
   ```bash
   scp nginx-config-www-slushdating-com.conf root@80.190.80.106:/tmp/
   ```

2. **SSH into your VPS:**
   ```bash
   ssh root@80.190.80.106
   ```

3. **Backup and update the config:**
   ```bash
   sudo cp /etc/nginx/sites-available/www-slushdating-com /etc/nginx/sites-available/www-slushdating-com.backup
   sudo cp /tmp/nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com
   ```

4. **Test and reload nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Option 2: Manual Fix

Edit `/etc/nginx/sites-available/www-slushdating-com` on your VPS and ensure you have:

1. **Asset location block** (must come BEFORE the `/app/` location):
   ```nginx
   location ~* ^/app/(.+\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))$ {
       alias /root/slush-app/dist/$1;
       expires 1y;
       add_header Cache-Control "public, immutable";
       access_log off;
   }
   ```

2. **App location block** with proper fallback:
   ```nginx
   location /app/ {
       alias /root/slush-app/dist/;
       index index.html;
       try_files $uri $uri/ @app_fallback;
   }

   location @app_fallback {
       rewrite ^/app/(.*)$ /app/index.html last;
   }
   ```

## Verify the Fix

1. **Check browser console** (F12):
   - Should see no 404 errors for `.js` or `.css` files
   - Assets should load from `/app/assets/...`

2. **Check network tab**:
   - All requests to `/app/assets/*` should return 200 status
   - `index.html` should load successfully

3. **Test the app**:
   - Visit `https://www.slushdating.com/app`
   - Should see the app loading (splash screen or login)

## Additional Checks

If the white screen persists after fixing nginx:

1. **Ensure the app is built correctly:**
   ```bash
   export VITE_USE_SUBPATH=true
   npm run build
   ```

2. **Verify dist folder structure:**
   ```bash
   ls -la /root/slush-app/dist/
   # Should see: index.html, assets/, vite.svg, default-event.png
   ```

3. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Check browser console for JavaScript errors** - these might indicate other issues

## What Was Fixed

- Added proper location block for static assets (`/app/assets/*`)
- Fixed `try_files` directive to use named location fallback
- Ensured asset location comes before general `/app/` location (nginx processes locations in order)

