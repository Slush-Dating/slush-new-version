#!/bin/bash

# Deployment script for nginx API connection fix
# This script uploads and applies the fixed nginx configuration

set -e

VPS_IP="80.190.80.106"
VPS_USER="root"
NGINX_CONFIG="nginx-config-www-slushdating-com.conf"
NGINX_CONFIG_PATH="/etc/nginx/sites-available/www-slushdating-com"

echo "🚀 Deploying nginx API connection fix..."
echo ""

# Check if config file exists
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Error: $NGINX_CONFIG not found!"
    exit 1
fi

echo "📤 Uploading nginx configuration to VPS..."
scp "$NGINX_CONFIG" ${VPS_USER}@${VPS_IP}:/tmp/${NGINX_CONFIG}

echo ""
echo "🔧 Applying configuration on VPS..."
ssh ${VPS_USER}@${VPS_IP} << 'EOF'
    # Backup current config
    sudo cp /etc/nginx/sites-available/www-slushdating-com /etc/nginx/sites-available/www-slushdating-com.backup.$(date +%Y%m%d_%H%M%S)
    
    # Copy new config
    sudo cp /tmp/nginx-config-www-slushdating-com.conf /etc/nginx/sites-available/www-slushdating-com
    
    # Test nginx configuration
    echo ""
    echo "🧪 Testing nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx configuration test passed!"
        echo ""
        echo "🔄 Reloading nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded successfully!"
    else
        echo "❌ Nginx configuration test failed!"
        echo "Restoring backup..."
        sudo cp /etc/nginx/sites-available/www-slushdating-com.backup.* /etc/nginx/sites-available/www-slushdating-com
        exit 1
    fi
    
    # Verify backend is running
    echo ""
    echo "🔍 Checking backend server status..."
    if pm2 list | grep -q "slush-server"; then
        echo "✅ Backend server is running"
        pm2 status slush-server
    else
        echo "⚠️  Warning: Backend server not found in PM2"
    fi
    
    # Test API endpoint
    echo ""
    echo "🧪 Testing API endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/events | grep -q "200\|404"; then
        echo "✅ Backend API is accessible"
    else
        echo "⚠️  Warning: Could not reach backend API"
    fi
EOF

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test login/register at https://www.slushdating.com/app"
echo "2. Check browser console for API URLs"
echo "3. Monitor nginx logs: ssh ${VPS_USER}@${VPS_IP} 'sudo tail -f /var/log/nginx/error.log'"
echo "4. Monitor backend logs: ssh ${VPS_USER}@${VPS_IP} 'pm2 logs slush-server'"

