# Vercel + VPS Routing Setup for slushdating.com

This guide explains how to set up `slushdating.com` so that:
- **Main website** (`slushdating.com`) → Vercel
- **App** (`slushdating.com/app/*`) → VPS
- **API** (`slushdating.com/api/*`) → VPS
- **Socket.IO** (`slushdating.com/socket.io/*`) → VPS

## Architecture Overview

```
slushdating.com (DNS → Vercel)
├── / (root) → Vercel (marketing website)
├── /app/* → Proxy to VPS (React app)
├── /api/* → Proxy to VPS (backend API)
└── /socket.io/* → Proxy to VPS (WebSocket)
```

## Step 1: Configure Vercel Rewrites

Create or update `vercel.json` in your Vercel project root:

```json
{
  "rewrites": [
    {
      "source": "/app/:path*",
      "destination": "https://YOUR_VPS_IP_OR_DOMAIN/app/:path*"
    },
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_VPS_IP_OR_DOMAIN/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://YOUR_VPS_IP_OR_DOMAIN/socket.io/:path*"
    },
    {
      "source": "/uploads/:path*",
      "destination": "https://YOUR_VPS_IP_OR_DOMAIN/uploads/:path*"
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

**Important**: Replace `YOUR_VPS_IP_OR_DOMAIN` with:
- Your VPS IP: `80.190.80.106` (if using IP)
- Or a subdomain: `app.slushdating.com` (recommended - see Step 2)

## Step 2: DNS Configuration (Recommended)

For better setup, create a subdomain for your VPS:

1. **Create A record**: `app.slushdating.com` → `80.190.80.106`
2. **Update vercel.json** to use `https://app.slushdating.com` instead of IP
3. **Update nginx** on VPS to accept `app.slushdating.com` (see Step 3)

This way:
- `slushdating.com` → Vercel
- `app.slushdating.com` → VPS (direct access)
- Vercel proxies `/app` and `/api` to `app.slushdating.com`

## Step 3: Update VPS Nginx Configuration

Your VPS nginx needs to accept requests from Vercel. Update your nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name app.slushdating.com slushdating.co.uk www.slushdating.co.uk;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/app.slushdating.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.slushdating.com/privkey.pem;

    # Allow requests from Vercel
    set_real_ip_from 76.76.21.0/24;  # Vercel IP range
    set_real_ip_from 76.223.126.0/24; # Vercel IP range
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    # API proxy
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

    # Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }

    # Frontend app at /app subpath
    location /app {
        alias /root/slush-app/dist;
        index index.html;
        try_files $uri $uri/ /app/index.html;
    }

    # Static assets
    location ~* ^/app/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        alias /root/slush-app/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Step 4: Update Frontend Code

The frontend code needs to recognise `slushdating.com` as a production domain. The code has been updated to support this.

## Step 5: Deploy

1. **Deploy to Vercel**: Push your `vercel.json` configuration
2. **Deploy to VPS**: Run your deployment script (updated for `slushdating.com`)
3. **Test**: 
   - Visit `slushdating.com` → Should show Vercel website
   - Visit `slushdating.com/app` → Should show React app
   - Visit `slushdating.com/api/events` → Should return API data

## Alternative: Direct DNS Routing (Simpler)

If you prefer not to use Vercel rewrites, you can:

1. Point `slushdating.com` DNS directly to VPS
2. Configure nginx to serve:
   - `/` → Proxy to Vercel (using `proxy_pass`)
   - `/app/*` → Serve React app
   - `/api/*` → Serve backend

However, this is more complex and Vercel rewrites are recommended.

## Troubleshooting

### CORS Issues
If you see CORS errors, ensure your backend allows `slushdating.com`:

```javascript
// In server/index.js
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://slushdating.com');
    // ... rest of CORS config
});
```

### WebSocket Issues
Vercel rewrites support WebSockets, but ensure:
1. Headers are set correctly (see vercel.json example)
2. Backend accepts WebSocket upgrades
3. nginx is configured for WebSocket proxying

### SSL Certificate
Ensure SSL certificates are valid for:
- `slushdating.com` (Vercel handles this)
- `app.slushdating.com` (VPS needs this)


