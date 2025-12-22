# Quick Setup Guide: slushdating.com with Vercel + VPS

## Overview

This setup allows:
- ✅ `slushdating.com` → Vercel (your marketing website)
- ✅ `slushdating.com/app` → VPS (React app)
- ✅ `slushdating.com/api` → VPS (backend API)
- ✅ `slushdating.com/socket.io` → VPS (WebSocket)

## Step-by-Step Setup

### 1. DNS Configuration

Create these DNS records:

```
Type    Name                    Value
A       slushdating.com         → Vercel IP (auto-configured by Vercel)
A       app.slushdating.com     → 80.190.80.106 (your VPS IP)
```

**Note**: Vercel will automatically configure the A record for `slushdating.com` when you add the domain. You only need to create the `app.slushdating.com` A record pointing to your VPS.

### 2. Vercel Configuration

1. **Add domain to Vercel**: In your Vercel dashboard, add `slushdating.com` as a custom domain
2. **Deploy `vercel.json`**: The `vercel.json` file is already created in the project root. It will:
   - Proxy `/app/*` → `https://app.slushdating.com/app/*`
   - Proxy `/api/*` → `https://app.slushdating.com/api/*`
   - Proxy `/socket.io/*` → `https://app.slushdating.com/socket.io/*`
   - Proxy `/uploads/*` → `https://app.slushdating.com/uploads/*`

3. **Deploy your website**: Push your website code to Vercel

### 3. VPS Configuration

1. **Update nginx config**: Copy `nginx-config-slushdating-com.conf` to your VPS:
   ```bash
   scp nginx-config-slushdating-com.conf user@80.190.80.106:/tmp/
   ```

2. **On your VPS**, replace the nginx config:
   ```bash
   sudo cp /tmp/nginx-config-slushdating-com.conf /etc/nginx/sites-available/slush-app
   ```

3. **Get SSL certificate** for `app.slushdating.com`:
   ```bash
   sudo certbot --nginx -d app.slushdating.com --non-interactive --agree-tos --email your-email@example.com
   ```

4. **Test and restart nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 4. Update Frontend Code

The frontend code has already been updated to recognise `slushdating.com` as a production domain. No changes needed!

### 5. Test Everything

1. **Website**: Visit `https://slushdating.com` → Should show Vercel website
2. **App**: Visit `https://slushdating.com/app` → Should show React app
3. **API**: Visit `https://slushdating.com/api/events` → Should return JSON
4. **Direct VPS access**: Visit `https://app.slushdating.com/app` → Should also work

## How It Works

```
User visits slushdating.com/app
    ↓
Vercel receives request
    ↓
Vercel checks vercel.json rewrites
    ↓
Vercel proxies to https://app.slushdating.com/app
    ↓
DNS resolves app.slushdating.com → 80.190.80.106
    ↓
VPS nginx receives request
    ↓
Nginx serves React app from /root/slush-app/dist
```

## Troubleshooting

### Issue: CORS errors
**Solution**: The backend already allows all origins (`*`), so this shouldn't be an issue. If you see CORS errors, check that requests are going through Vercel correctly.

### Issue: WebSocket not connecting
**Solution**: Ensure:
1. `vercel.json` has the WebSocket headers (already included)
2. nginx is configured for WebSocket proxying (already configured)
3. Backend Socket.IO is running on port 5001

### Issue: SSL certificate errors
**Solution**: Make sure you've run certbot for `app.slushdating.com`:
```bash
sudo certbot --nginx -d app.slushdating.com
```

### Issue: 502 Bad Gateway
**Solution**: Check that:
1. Backend server is running: `pm2 status`
2. Backend is listening on port 5001: `netstat -tlnp | grep 5001`
3. nginx can reach backend: `curl http://localhost:5001/api/events`

## Alternative: Using IP Instead of Subdomain

If you prefer not to use `app.slushdating.com`, you can use your VPS IP directly in `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/app/:path*",
      "destination": "https://80.190.80.106/app/:path*"
    }
  ]
}
```

**However**, this requires:
- SSL certificate for IP (more complex)
- Updating certificate when IP changes
- Less professional setup

**Recommendation**: Use the subdomain approach (`app.slushdating.com`).


