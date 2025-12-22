# Quick Deployment Instructions

## One-Command Deployment

Run this command from the project root to deploy the nginx fix:

```bash
scp nginx-config-www-slushdating-com.conf root@80.190.80.106:/tmp/ && ssh root@80.190.80.106 "sudo cp /tmp/nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com && sudo nginx -t && sudo systemctl reload nginx && echo '✅ Deployment successful!'"
```

## Or Use the Deployment Script

```bash
./deploy-nginx-fix.sh
```

## What Was Fixed

✅ **nginx-config-www-slushdating-com.conf** - Fixed API proxy to preserve `/api` prefix
✅ **nginx-config-slushdating-com.conf** - Fixed API proxy to preserve `/api` prefix  
✅ **src/services/authService.ts** - Enhanced error handling and debugging

## After Deployment

1. Test login at: https://www.slushdating.com/app
2. Check browser console (F12) - should see API URL: `https://www.slushdating.com/api/auth/login`
3. Verify backend is running: `ssh root@80.190.80.106 'pm2 status'`

## If You Get Permission Denied

Make sure you have SSH access configured. You may need to:
- Use a different username (not `root`)
- Set up SSH keys
- Or manually copy the file and SSH in separately

