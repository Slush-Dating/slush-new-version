#!/bin/bash

# Manual deployment script for staging server
# Usage: ./deploy-server-staging.sh

set -e

VPS_HOST="slushdating.com"
VPS_USER="root"
VPS_PASSWORD="Tricky88119!"
SERVER_PATH="/root/slush-staging/server"
TEMP_PATH="/tmp/slush-server-update-$(date +%s)"

echo "🚀 Deploying server code to staging..."
echo "======================================"
echo "Host: $VPS_HOST"
echo "User: $VPS_USER"
echo "Target: $SERVER_PATH"
echo ""

# Check if sshpass is available (for password authentication)
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install hudochenkov/sshpass/sshpass
        else
            echo "❌ Please install sshpass: brew install hudochenkov/sshpass/sshpass"
            exit 1
        fi
    else
        echo "❌ Please install sshpass: sudo apt-get install sshpass"
        exit 1
    fi
fi

# Create temporary directory for server files
echo "📦 Preparing server files..."
TEMP_LOCAL="/tmp/slush-server-local-$(date +%s)"
mkdir -p "$TEMP_LOCAL"
cp -r packages/server/* "$TEMP_LOCAL/"

# Copy server files to VPS
echo "📤 Uploading server files to VPS..."
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no -r "$TEMP_LOCAL"/* "${VPS_USER}@${VPS_HOST}:${TEMP_PATH}/" || {
    echo "❌ Failed to upload files"
    rm -rf "$TEMP_LOCAL"
    exit 1
}

# Clean up local temp
rm -rf "$TEMP_LOCAL"

# SSH into server and deploy
echo "🔧 Deploying on server..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" << EOF
    set -e
    echo "📋 Current server status..."
    pm2 list | grep slush-server-staging || echo "⚠️  Server not running"
    
    echo "📂 Copying files to staging directory..."
    mkdir -p $SERVER_PATH
    cp -r $TEMP_PATH/* $SERVER_PATH/
    
    echo "📦 Installing dependencies..."
    cd $SERVER_PATH
    npm install --production
    
    echo "🔄 Restarting staging server..."
    pm2 restart slush-server-staging || (cd $SERVER_PATH && pm2 start index.js --name slush-server-staging --env staging)
    
    echo "🧹 Cleaning up temp files..."
    rm -rf $TEMP_PATH
    
    echo "✅ Deployment complete!"
    echo ""
    echo "📊 Server status:"
    pm2 list | grep slush-server-staging
    echo ""
    echo "📝 Recent logs:"
    pm2 logs slush-server-staging --lines 10 --nostream
EOF

echo ""
echo "✅ Server deployment complete!"
echo "🔗 Test the API: https://staging.slushdating.com/api/auth/profile"
echo ""

