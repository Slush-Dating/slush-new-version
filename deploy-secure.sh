#!/bin/bash

# Secure Deployment Script
# Uses environment variables for sensitive data
# Run with: MONGODB_URI="your_connection_string" ./deploy-secure.sh

echo "🔐 Secure Slush App Deployment"
echo "================================"

# Configuration - Update these as needed
SERVER_IP="80.190.80.106"
SERVER_PASSWORD="Tricky88119!"
SERVER_USER="root"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check for required environment variables
if [ -z "$MONGODB_URI" ]; then
    print_error "MONGODB_URI environment variable is not set!"
    echo "Usage: MONGODB_URI='your_mongodb_connection_string' $0"
    exit 1
fi

print_status "MongoDB URI is set (length: ${#MONGODB_URI} characters)"

# Step 1: Build the application
echo "📦 Building application..."
if npm run build; then
    print_status "Build completed successfully"
else
    print_error "Build failed!"
    exit 1
fi

# Step 2: Create deployment package
echo "📦 Creating deployment package..."
cd /Users/user/Desktop/slush-new-version-react

# Remove any existing tar file
rm -f ../slush-app.tar.gz

# Create new tar file
if tar -czf ../slush-app.tar.gz --exclude='node_modules' --exclude='.git' --exclude='*.log' --exclude='android/app/build' --exclude='ios/App/build' --exclude='ios/DerivedData' --exclude='server/uploads' --exclude='server/node_modules' --exclude='dist' .; then
    print_status "Deployment package created"
else
    print_error "Failed to create deployment package!"
    exit 1
fi

# Step 3: Copy to server
echo "📤 Copying to server ($SERVER_IP)..."
if sshpass -p "$SERVER_PASSWORD" scp ../slush-app.tar.gz $SERVER_USER@$SERVER_IP:~/; then
    print_status "Package copied to server"
else
    print_error "Failed to copy package to server!"
    exit 1
fi

# Step 4: Deploy on server with environment variable
echo "🚀 Deploying on server..."
DEPLOY_CMD="cd ~/ && tar -xzf slush-app.tar.gz -C slush-app --strip-components=1 && cd ~/slush-app && export MONGODB_URI=\"$MONGODB_URI\" && ./deploy-to-vps.sh"

if sshpass -p "$SERVER_PASSWORD" ssh $SERVER_USER@$SERVER_IP "$DEPLOY_CMD"; then
    print_status "Deployment completed on server"
else
    print_error "Deployment failed on server!"
    exit 1
fi

# Step 5: Clean up conflicting nginx configs and reload
echo "🧹 Cleaning up conflicting nginx configs..."
if sshpass -p "$SERVER_PASSWORD" ssh $SERVER_USER@$SERVER_IP "ls -la /etc/nginx/sites-enabled/ && find /etc/nginx/sites-enabled/ -type l ! -name slush-app -delete && ls -la /etc/nginx/sites-enabled/"; then
    print_status "Cleaned up conflicting nginx configs"
else
    print_warning "Could not clean up nginx configs"
fi

echo "🔄 Reloading nginx..."
if sshpass -p "$SERVER_PASSWORD" ssh $SERVER_USER@$SERVER_IP "nginx -t && systemctl reload nginx"; then
    print_status "Nginx reloaded successfully"
else
    print_warning "Nginx reload failed - you may need to check configuration manually"
fi

# Step 6: Verify deployment
echo "🔍 Verifying deployment..."
if sshpass -p "$SERVER_PASSWORD" ssh $SERVER_USER@$SERVER_IP "pm2 list && echo '--- Nginx Status ---' && systemctl status nginx --no-pager | head -10"; then
    print_status "Deployment verification completed"
else
    print_warning "Could not verify deployment status"
fi

# Step 7: Cleanup
echo "🧹 Cleaning up..."
rm -f ../slush-app.tar.gz
print_status "Local cleanup completed"

echo ""
print_status "🎉 Secure deployment completed successfully!"
echo ""
echo "🌐 Your sites are available at:"
echo "   - https://www.slushdating.com/ (Marketing Site)"
echo "   - https://www.slushdating.com/app/ (Web App)"
echo "   - https://www.slushdating.com/admin/ (Admin Panel)"
echo ""
echo "📋 Remember to:"
echo "   1. Ensure DNS points www.slushdating.com to $SERVER_IP"
echo "   2. Run SSL setup once DNS propagates:"
echo "      ssh root@$SERVER_IP 'certbot --nginx -d slushdating.com -d www.slushdating.com --non-interactive --agree-tos --email your-email@example.com'"
echo ""
echo "🔧 Useful commands:"
echo "   ./deploy-secure.sh                    # Deploy changes"
echo "   ssh root@$SERVER_IP 'pm2 logs'        # View server logs"
echo "   ssh root@$SERVER_IP 'pm2 monit'       # Monitor processes"
