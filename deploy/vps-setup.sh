#!/bin/bash
# One-time VPS Setup for Staging and Production
# Run this script ONCE on the VPS to set up the environment
# 
# Usage: scp deploy/vps-setup.sh root@80.190.80.106:/tmp/ && \
#        ssh root@80.190.80.106 "chmod +x /tmp/vps-setup.sh && /tmp/vps-setup.sh"

set -e

echo "🔧 Setting up VPS for Staging and Production..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p /var/www/slush-staging
mkdir -p /var/www/slush-prod

# Set permissions
chown -R www-data:www-data /var/www/slush-staging
chown -R www-data:www-data /var/www/slush-prod
chmod -R 755 /var/www/slush-staging
chmod -R 755 /var/www/slush-prod

echo "✅ Directories created:"
echo "   - /var/www/slush-staging (for staging.slushdating.com)"
echo "   - /var/www/slush-prod (for app.slushdating.com)"

# Note about nginx configs
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Upload nginx configs (from local machine):"
echo "   scp deploy/nginx-staging.conf root@80.190.80.106:/etc/nginx/sites-available/staging-slushdating-com"
echo "   scp deploy/nginx-production.conf root@80.190.80.106:/etc/nginx/sites-available/app-slushdating-com"
echo ""
echo "2. Enable nginx sites:"
echo "   ln -sf /etc/nginx/sites-available/staging-slushdating-com /etc/nginx/sites-enabled/"
echo "   ln -sf /etc/nginx/sites-available/app-slushdating-com /etc/nginx/sites-enabled/"
echo ""
echo "3. Set up DNS (A records pointing to 80.190.80.106):"
echo "   - staging.slushdating.com"
echo "   - app.slushdating.com"
echo ""
echo "4. Get SSL certificates (after DNS propagation):"
echo "   certbot --nginx -d staging.slushdating.com"
echo "   certbot --nginx -d app.slushdating.com"
echo ""
echo "5. Test and reload nginx:"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "🎉 VPS setup complete!"
