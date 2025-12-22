# Vercel Setup Instructions - Easy Guide

## Quick Overview

You already have `www.slushdating.com` configured on Vercel. We're adding proxy routes so that:
- `www.slushdating.com` → Your Vercel website (unchanged)
- `www.slushdating.com/app` → Your React app on VPS
- `www.slushdating.com/api` → Your backend API on VPS
- `www.slushdating.com/admin` → Your admin panel on VPS

---

## Step 1: Add the vercel.json File

1. **Open your project** in Vercel dashboard
2. **Go to Settings** → **General**
3. **Scroll down** to find your project files
4. **Make sure** `vercel.json` is in your project root (it should already be there)

The `vercel.json` file contains:
```json
{
  "rewrites": [
    {
      "source": "/app/:path*",
      "destination": "https://app.slushdating.com/app/:path*"
    },
    {
      "source": "/admin/:path*",
      "destination": "https://app.slushdating.com/app/admin/:path*"
    },
    {
      "source": "/api/:path*",
      "destination": "https://app.slushdating.com/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://app.slushdating.com/socket.io/:path*"
    },
    {
      "source": "/uploads/:path*",
      "destination": "https://app.slushdating.com/uploads/:path*"
    }
  ],
  "headers": [
    {
      "source": "/socket.io/:path*",
      "headers": [
        {
          "key": "Upgrade",
          "value": "websocket"
        },
        {
          "key": "Connection",
          "value": "Upgrade"
        }
      ]
    }
  ]
}
```

---

## Step 2: Deploy to Vercel

1. **Push your code** to your Git repository (if using Git)
   ```bash
   git add vercel.json
   git commit -m "Add Vercel proxy configuration"
   git push
   ```

2. **OR** if you're deploying manually:
   - Go to **Deployments** tab in Vercel
   - Click **Redeploy** on your latest deployment
   - Vercel will automatically pick up the `vercel.json` file

---

## Step 3: Verify It's Working

After deployment, test these URLs:

✅ **Your website** (should work as before):
- `https://www.slushdating.com`

✅ **Your app** (should show React app):
- `https://www.slushdating.com/app`

✅ **Your API** (should return JSON):
- `https://www.slushdating.com/api/events`

✅ **Your admin panel** (should show admin interface):
- `https://www.slushdating.com/admin`

---

## What Each Route Does

| Route | What It Does |
|-------|-------------|
| `/app/*` | Proxies to your React app on VPS |
| `/admin/*` | Proxies to admin panel (part of React app) |
| `/api/*` | Proxies to your backend API on VPS |
| `/socket.io/*` | Proxies WebSocket connections to VPS |
| `/uploads/*` | Proxies media files to VPS |

---

## Important Notes

⚠️ **DNS Requirement**: You need an A record for `app.slushdating.com` pointing to your VPS IP (`80.190.80.106`). This is where Vercel proxies the requests.

⚠️ **SSL Certificate**: Your VPS needs an SSL certificate for `app.slushdating.com`. See VPS setup instructions.

⚠️ **No Changes Needed**: Your existing `www.slushdating.com` configuration stays exactly the same. This only adds new routes.

---

## Troubleshooting

### Problem: Routes return 404 or error
**Solution**: 
1. Check that `app.slushdating.com` DNS is pointing to your VPS
2. Verify your VPS nginx is configured correctly
3. Check VPS logs: `pm2 logs slush-server`

### Problem: WebSocket not connecting
**Solution**: 
1. Verify the headers section in `vercel.json` is present
2. Check that your backend Socket.IO is running
3. Test direct connection: `https://app.slushdating.com/socket.io/`

### Problem: CORS errors
**Solution**: 
- Your backend already allows all origins, so this shouldn't happen
- If it does, check that requests are going through Vercel (not directly to VPS)

---

## That's It! 🎉

Once you've deployed `vercel.json`, the routes will automatically work. No need to change any Vercel dashboard settings - the file handles everything!


