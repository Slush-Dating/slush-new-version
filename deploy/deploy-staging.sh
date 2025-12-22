#!/bin/bash
# Deploy to Staging Environment
# Usage: ./deploy/deploy-staging.sh
# 
# Prerequisites:
# - sshpass installed (brew install hudochenkov/sshpass/sshpass)
# - VPS directories created: /var/www/slush-staging
# - nginx config installed once

set -e

# Configuration
VPS_HOST="80.190.80.106"
VPS_USER="root"
VPS_PASS="Tricky88119!"
STAGING_DIR="/var/www/slush-staging"

echo "🚀 Deploying to STAGING environment..."
echo "📍 Target: staging.slushdating.com -> ${STAGING_DIR}"

# Step 1: Build frontend for staging
echo ""
echo "📦 Building frontend for staging..."
npm run build:staging

# Step 2: Upload dist folder to VPS
echo ""
echo "📤 Uploading dist to VPS..."
sshpass -p "${VPS_PASS}" rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    ./dist/ \
    ${VPS_USER}@${VPS_HOST}:${STAGING_DIR}/

# Step 3: Verify deployment
echo ""
echo "✅ Verifying deployment..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} \
    "ls -la ${STAGING_DIR} && echo '✅ Staging deployment complete!'"

echo ""
echo "🎉 Staging deployment successful!"
echo "🔗 Access at: https://staging.slushdating.com"
echo ""
echo "Note: No nginx restart needed - just file copy!"
