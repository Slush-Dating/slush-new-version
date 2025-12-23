#!/bin/bash
echo "🚀 Deploying video upload fixes to staging.slushdating.com"
echo "======================================================"

echo "📋 Deployment commands:"
echo ""

echo "# 1. SSH into staging server"
echo "ssh user@80.190.80.106"
echo ""

echo "# 2. Navigate to staging directory"
echo "cd /root/slush-staging"
echo ""

echo "# 3. Pull latest changes"
echo "git pull origin main"
echo ""

echo "# 4. Install backend dependencies"
echo "cd server && npm install"
echo ""

echo "# 5. Install FFmpeg (if not already installed)"
echo "sudo apt update && sudo apt install -y ffmpeg"
echo ""

echo "# 6. Update nginx config with increased timeouts"
echo "sudo cp nginx-config-staging-slushdating-com.conf /etc/nginx/sites-available/staging-slushdating-com"
echo ""

echo "# 7. Test nginx config"
echo "sudo nginx -t"
echo ""

echo "# 8. Restart services"
echo "sudo systemctl restart nginx"
echo "pm2 restart slush-server-staging"
echo ""

echo "# 9. Test the fixes"
echo "curl https://staging.slushdating.com/api/auth/health/ffmpeg"
echo "curl -k -s -I https://staging.slushdating.com/api/events"
echo ""

echo "✅ Deployment complete!"
echo "Test video upload in onboarding now."

