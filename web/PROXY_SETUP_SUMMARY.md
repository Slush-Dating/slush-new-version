# Proxy Setup Summary for www.slushdating.com

## Quick Setup

1. **Copy nginx config to VPS**:
   ```bash
   sudo cp nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com
   ```

2. **Enable site**:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/www-slushdating-com /etc/nginx/sites-enabled/
   ```

3. **Get SSL certificate**:
   ```bash
   sudo certbot --nginx -d www.slushdating.com -d slushdating.com
   ```

4. **Test and restart**:
   ```bash
   sudo nginx -t && sudo systemctl restart nginx
   ```

## Routes Configured

| Route | Destination | Type |
|-------|-------------|------|
| `/admin` | Redirects to `/app/admin` | Redirect |
| `/app` | Serves React app from `/root/slush-app/dist` | Static |
| `/api` | Proxies to `localhost:5001` | Proxy |
| `/socket.io` | Proxies to `localhost:5001` | Proxy (WebSocket) |
| `/uploads` | Proxies to `localhost:5001` | Proxy |
| `/` | Serves marketing site from `/root/slush-app/marketing/` | Static (SEPARATE - never deploy) |

## ⚠️  IMPORTANT: Marketing Site Protection

**DO NOT deploy the `marketing/` folder** - it will overwrite `www.slushdating.com`. Only deploy proxies (`/app`, `/api`, `/admin`).

## Testing

```bash
# Test API
curl https://www.slushdating.com/api/events

# Test app
curl -I https://www.slushdating.com/app/

# Test admin (should redirect)
curl -I https://www.slushdating.com/admin
```

## Notes

- `/admin` redirects to `/app/admin` because the React app is built with base `/app/`
- This ensures assets load correctly
- React Router handles the `/admin` route within the app

For detailed instructions, see `WWW_SLUSHDATING_SETUP.md`.




