# VPS Setup for Vercel Proxies

This guide sets up your VPS to handle requests proxied from Vercel.

## Prerequisites

- VPS IP: `80.190.80.106`
- Domain: `app.slushdating.com` (subdomain for VPS)
- Your app is already deployed to VPS

---

## Step 1: DNS Configuration

Add this DNS record in your domain registrar:

```
Type: A
Name: app
Value: 80.190.80.106
TTL: 3600 (or default)
```

This creates `app.slushdating.com` pointing to your VPS.

**Verify DNS** (wait 5-10 minutes after adding):
```bash
dig app.slushdating.com
# Should return: 80.190.80.106
```

---

## Step 2: Update Nginx Configuration

1. **SSH into your VPS**:
   ```bash
   ssh user@80.190.80.106
   ```

2. **Backup current config**:
   ```bash
   sudo cp /etc/nginx/sites-available/slush-app /etc/nginx/sites-available/slush-app.backup
   ```

3. **Update nginx config** to accept `app.slushdating.com`:
   ```bash
   sudo nano /etc/nginx/sites-available/slush-app
   ```

4. **Update the server_name** line to include `app.slushdating.com`:
   ```nginx
   server_name app.slushdating.com slushdating.co.uk www.slushdating.co.uk;
   ```

5. **Add Vercel IP handling** (add this after the `ssl_prefer_server_ciphers` line):
   ```nginx
   # Handle requests from Vercel proxy
   set_real_ip_from 76.76.21.0/24;
   set_real_ip_from 76.223.126.0/24;
   real_ip_header X-Forwarded-For;
   real_ip_recursive on;
   ```

6. **Update CORS headers** in the `/api` location block to allow `www.slushdating.com`:
   ```nginx
   # CORS headers for API
   add_header 'Access-Control-Allow-Origin' 'https://www.slushdating.com' always;
   add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
   add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
   ```

7. **Save and exit** (Ctrl+X, then Y, then Enter)

---

## Step 3: Get SSL Certificate

1. **Get certificate for app.slushdating.com**:
   ```bash
   sudo certbot --nginx -d app.slushdating.com --non-interactive --agree-tos --email your-email@example.com
   ```

2. **If you already have certbot configured**, you can add the domain:
   ```bash
   sudo certbot --nginx -d app.slushdating.com
   ```

---

## Step 4: Test and Restart Nginx

1. **Test nginx configuration**:
   ```bash
   sudo nginx -t
   ```
   Should show: `syntax is ok` and `test is successful`

2. **Restart nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

3. **Check nginx status**:
   ```bash
   sudo systemctl status nginx
   ```

---

## Step 5: Verify Everything Works

Test these URLs directly on your VPS:

```bash
# Test API
curl https://app.slushdating.com/api/events

# Test app
curl -I https://app.slushdating.com/app/

# Test admin (should redirect to /app/admin)
curl -I https://app.slushdating.com/admin
```

---

## Complete Nginx Config Example

Here's what your `/api` location block should look like:

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

    # CORS headers for API - allow Vercel domain
    add_header 'Access-Control-Allow-Origin' 'https://www.slushdating.com' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

---

## Troubleshooting

### Problem: SSL certificate error
**Solution**: Make sure DNS is propagated first, then run certbot again

### Problem: 502 Bad Gateway
**Solution**: 
1. Check backend is running: `pm2 status`
2. Check backend logs: `pm2 logs slush-server`
3. Test backend directly: `curl http://localhost:5001/api/events`

### Problem: CORS errors
**Solution**: 
- Verify CORS header includes `https://www.slushdating.com`
- Check nginx config syntax: `sudo nginx -t`
- Restart nginx: `sudo systemctl restart nginx`

---

## That's It! ✅

Your VPS is now ready to receive proxied requests from Vercel. The routes will work automatically once Vercel's `vercel.json` is deployed.


