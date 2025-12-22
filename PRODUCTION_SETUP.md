# Production Setup Guide for TestFlight

This guide will help you configure your Slush Dating app for production deployment and TestFlight testing.

## 🚨 Critical Issues Fixed

### 1. Agora SDK HTTPS Requirement
Agora SDK requires HTTPS for security reasons. The app now:
- Uses HTTPS in production builds
- Properly configures Capacitor for secure connections
- Handles protocol detection for development vs production

### 2. API Configuration
- Updated `apiConfig.ts` to handle production domains properly
- Capacitor apps now use production URLs instead of IP addresses
- Environment-based configuration for different deployment stages

## 📋 Pre-Production Checklist

### 1. Domain Configuration
Replace all instances of `your-production-domain.com` with your actual domain:

**Files to update:**
- `capacitor.config.ts` - line 12: `hostname`
- `src/services/apiConfig.ts` - lines with `your-production-domain.com`
- `deploy-to-vps.sh` - nginx configuration
- Server environment variables

### 2. Agora SDK Configuration
You need valid Agora credentials for production:

1. Go to [Agora Console](https://console.agora.io/)
2. Create/get your App ID and App Certificate
3. Add them to your server environment:
   ```bash
   AGORA_APP_ID=your_actual_app_id
   AGORA_APP_CERTIFICATE=your_actual_certificate
   ```

### 3. Environment Variables
Create production environment files:

**For the client (Vite):**
```bash
# .env.production
VITE_PRODUCTION_API_URL=https://your-domain.com
VITE_AGORA_APP_ID=your_agora_app_id
```

**For the server:**
```bash
# server/.env
PORT=5001
HOST=0.0.0.0
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
PRODUCTION_API_URL=https://your-domain.com
```

### 4. SSL Certificate Setup
For production, you need a proper SSL certificate:

1. **Option A: Let's Encrypt (Recommended)**
   ```bash
   # After updating DNS to point to your server
   certbot --nginx -d your-domain.com -d www.your-domain.com --non-interactive --agree-tos --email your-email@example.com
   ```

2. **Option B: CloudFlare/CDN**
   Use CloudFlare for SSL termination and caching.

## 🚀 Deployment Steps

### 1. Server Setup
```bash
# Run the updated deploy script
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

### 2. Environment Configuration
```bash
# On your server, create the server environment file
nano ~/slush-app/server/.env
# Add your production environment variables
```

### 3. Build and Deploy
```bash
# Build the frontend
npm run build

# Start/restart services
cd ~/slush-app/server
pm2 restart slush-server
sudo systemctl restart nginx
```

## 📱 TestFlight Preparation

### 1. Capacitor Build
```bash
# Install dependencies
npm install

# Build for iOS
npx cap build ios

# Open in Xcode
npx cap open ios
```

### 2. Xcode Configuration
1. Open the project in Xcode
2. Update bundle identifier if needed
3. Configure code signing for TestFlight
4. Update app icons and launch screens
5. Test on device to ensure HTTPS works

### 3. TestFlight Submission
1. Archive the app in Xcode
2. Upload to App Store Connect
3. Configure TestFlight testing
4. Invite testers

## 🔧 Troubleshooting

### Common Issues:

1. **502 Bad Gateway**
   - Check if server is running: `pm2 status`
   - Check server logs: `pm2 logs slush-server`
   - Verify nginx configuration: `nginx -t`

2. **Agora Connection Issues**
   - Verify HTTPS is working
   - Check Agora credentials
   - Ensure firewall allows necessary ports

3. **API Connection Issues**
   - Verify domain DNS points to server
   - Check SSL certificate validity
   - Ensure nginx proxy is configured correctly

### Testing Commands:
```bash
# Test HTTPS
curl -I https://your-domain.com

# Test API
curl https://your-domain.com/api/auth/login

# Check server status
pm2 monit

# Check nginx status
sudo systemctl status nginx
```

## 📞 Support

If you encounter issues:
1. Check server logs: `pm2 logs slush-server`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables are loaded correctly
4. Test with a simple HTTP request first, then HTTPS

## 🔄 Next Steps After TestFlight

1. Monitor TestFlight feedback
2. Set up proper monitoring (PM2 monitoring, error tracking)
3. Configure backup systems
4. Set up CI/CD pipeline for automated deployments
5. Plan for Android release

---

**Remember:** Always test thoroughly before releasing to users. The Agora SDK requirements are strict about HTTPS, so ensure your production environment meets all security requirements.

