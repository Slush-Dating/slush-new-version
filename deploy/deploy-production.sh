#!/bin/bash
# Deploy to Production Environment
# Usage: ./deploy/deploy-production.sh
# 
# Prerequisites:
# - sshpass installed (brew install hudochenkov/sshpass/sshpass)
# - VPS directories created: /var/www/slush-prod
# - nginx config installed once

set -e

# Configuration
VPS_HOST="80.190.80.106"
VPS_USER="root"
VPS_PASS="Tricky88119!"
PROD_DIR="/var/www/slush-prod"

echo "🚀 Deploying to PRODUCTION environment..."
echo "📍 Target: app.slushdating.com -> ${PROD_DIR}"
echo ""
echo "⚠️  WARNING: You are deploying to PRODUCTION!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

# Step 1: Build frontend for production
echo ""
echo "📦 Building frontend for production..."
npm run build:production

# Step 2: Upload dist folder to VPS
echo ""
echo "📤 Uploading dist to VPS..."
sshpass -p "${VPS_PASS}" rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    ./dist/ \
    ${VPS_USER}@${VPS_HOST}:${PROD_DIR}/

# Step 3: Verify deployment
echo ""
echo "✅ Verifying deployment..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} \
    "ls -la ${PROD_DIR} && echo '✅ Production deployment complete!'"

echo ""
echo "🎉 Production deployment successful!"
echo "🔗 Access at: https://app.slushdating.com"
echo ""
echo "Note: No nginx restart needed - just file copy!"
