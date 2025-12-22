# VPS Deployment Guide for slushdating.co.uk/app

This guide covers deploying the Slush Dating app to your VPS at `80.190.80.106` with the domain `slushdating.co.uk/app`.

## Prerequisites

1. **Domain DNS Configuration**
   - Ensure `slushdating.co.uk` has an A record pointing to `80.190.80.106`
   - Optionally, `www.slushdating.co.uk` can CNAME to `slushdating.co.uk`
   - Wait for DNS propagation (can take up to 48 hours, usually much faster)

2. **Server Access**
   - SSH access to the VPS
   - Root or sudo privileges

## Deployment Steps

### 1. Prepare Your Local Build

Before deploying, ensure your code is ready:

```bash
# Test the build locally
npm install
export VITE_USE_SUBPATH=true
npm run build

# Verify the dist folder was created
ls -la dist/
```

### 2. Create Deployment Archive

On your local machine, create a tarball of the project:

```bash
# From the project root directory
tar -czf slush-app.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='ios' \
  --exclude='android' \
  --exclude='.env*' \
  .
```

### 3. Upload to VPS

Upload the archive to your VPS:

```bash
# Upload the archive
scp slush-app.tar.gz root@80.190.80.106:~/

# SSH into the VPS
ssh root@80.190.80.106
```

### 4. Run Deployment Script

On the VPS, run the deployment script:

```bash
# Upload the deployment script if not already there
# Or copy it from your local machine:
# scp deploy-to-vps.sh root@80.190.80.106:~/

# Make it executable
chmod +x deploy-to-vps.sh

# Run the deployment
./deploy-to-vps.sh
```

**Note:** The script will:
- Install Node.js, nginx, and other dependencies
- Extract your application files
- Install server dependencies
- Build the frontend with `/app` base path
- Configure nginx for the domain and subpath
- Set up a temporary self-signed SSL certificate
- Start the application with PM2

### 5. Configure SSL Certificate (After DNS Propagation)

Once DNS has propagated and `slushdating.co.uk` resolves to your server:

```bash
# Replace your-email@example.com with your actual email
certbot --nginx -d slushdating.co.uk -d www.slushdating.co.uk \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com

# Restart nginx
systemctl restart nginx
```

### 6. Verify Deployment

After deployment, verify everything is working:

```bash
# Check PM2 status
pm2 status

# Check nginx status
systemctl status nginx

# View server logs
pm2 logs slush-server

# Test nginx configuration
nginx -t
```

## Accessing Your Application

Once deployed and DNS is configured:

- **Web App**: https://slushdating.co.uk/app/
- **API**: https://slushdating.co.uk/api/
- **Socket.IO**: https://slushdating.co.uk/socket.io/

## Configuration Details

### Frontend Base Path
- The app is configured to run at `/app` subpath
- This is set via `VITE_USE_SUBPATH=true` during build
- The vite.config.ts uses `/app/` as the base path in production

### API Configuration
- API calls automatically use the production domain (no port needed)
- Socket.IO connections use the production domain
- Media uploads are served through nginx proxy

### Nginx Configuration
- HTTP requests redirect to HTTPS
- Frontend served from `/app/` location
- API proxied to `localhost:5001`
- Socket.IO proxied to `localhost:5001`
- Uploads served from `/uploads/`

## Troubleshooting

### 502 Bad Gateway
```bash
# Check if server is running
pm2 status

# Restart server
pm2 restart slush-server

# Check server logs
pm2 logs slush-server

# Verify nginx can reach the backend
curl http://localhost:5001/api/events
```

### SSL Certificate Issues
```bash
# Test certificate
certbot certificates

# Renew certificate manually
certbot renew

# Check nginx SSL configuration
nginx -t
```

### DNS Not Resolving
```bash
# Test DNS resolution
dig slushdating.co.uk
nslookup slushdating.co.uk

# Check from different locations
# Use online tools like whatsmydns.net
```

### Application Not Loading at /app
```bash
# Check nginx error logs
tail -f /var/log/nginx/error.log

# Verify dist folder exists
ls -la /root/slush-app/dist/

# Check nginx configuration
nginx -t
cat /etc/nginx/sites-available/slush-app
```

### API Calls Failing
- Verify the API is accessible: `curl https://slushdating.co.uk/api/events`
- Check browser console for CORS errors
- Verify nginx proxy configuration
- Check server logs: `pm2 logs slush-server`

## Updating the Application

To update the application after initial deployment:

```bash
# On your local machine
npm run build
tar -czf slush-app-update.tar.gz dist/ server/

# Upload to VPS
scp slush-app-update.tar.gz root@80.190.80.106:~/

# On VPS
ssh root@80.190.80.106
cd ~/slush-app
tar -xzf ~/slush-app-update.tar.gz

# Update server dependencies if needed
cd server
npm install

# Restart services
pm2 restart slush-server
systemctl reload nginx
```

## Environment Variables

The server uses environment variables from `~/slush-app/server/.env`:

```bash
PORT=5001
HOST=0.0.0.0
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production
```

To update environment variables:

```bash
nano ~/slush-app/server/.env
pm2 restart slush-server
```

## Useful Commands

```bash
# PM2 Management
pm2 status                    # Check process status
pm2 restart slush-server      # Restart server
pm2 logs slush-server         # View logs
pm2 monit                     # Monitor processes
pm2 stop slush-server         # Stop server
pm2 delete slush-server       # Remove from PM2

# Nginx Management
nginx -t                      # Test configuration
systemctl restart nginx       # Restart nginx
systemctl reload nginx        # Reload configuration
systemctl status nginx        # Check status
tail -f /var/log/nginx/error.log  # View error logs

# SSL Certificate
certbot certificates          # List certificates
certbot renew                # Renew certificates
certbot renew --dry-run      # Test renewal
```

## Security Considerations

1. **Firewall**: The deployment script configures UFW firewall
2. **SSL**: Use Let's Encrypt certificates (not self-signed) in production
3. **Environment Variables**: Never commit `.env` files to git
4. **Updates**: Keep system packages updated regularly
5. **Monitoring**: Set up monitoring for PM2 and nginx

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs slush-server`
2. Check nginx logs: `tail -f /var/log/nginx/error.log`
3. Verify DNS resolution
4. Test API endpoints directly
5. Check firewall rules: `ufw status`

