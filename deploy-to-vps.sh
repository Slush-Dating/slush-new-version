#!/bin/bash

echo "🚀 Starting deployment of Slush App to VPS..."

# Update system and install dependencies
echo "📦 Updating system and installing dependencies..."
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx software-properties-common

# Install MongoDB (if needed for local development - Atlas is used in production)
# echo "📦 Installing MongoDB..."
# wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
# echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
# apt-get update
# apt-get install -y mongodb-org

# Install PM2 globally
npm install -g pm2

# Create app directory and extract files
echo "📁 Setting up application directory..."
mkdir -p ~/slush-app
cd ~/
tar -xzf slush-app.tar.gz -C slush-app --strip-components=1
cd ~/slush-app

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install

# Create production environment file
echo "⚙️ Setting up environment variables..."
cat > .env << 'ENVEOF'
PORT=5001
HOST=0.0.0.0
MONGODB_URI=${MONGODB_URI}
NODE_ENV=production
ENVEOF

# MongoDB Atlas - No local installation needed
echo "☁️ Using MongoDB Atlas - skipping local MongoDB installation"

# Build and setup frontend
echo "🎨 Building frontend..."
cd ..
npm install
# Set environment variables for production build
export VITE_USE_SUBPATH=true
export VITE_PRODUCTION_API_HOST=www.slushdating.com
npm run build

# Configure nginx with SSL
echo "🌐 Configuring nginx with SSL..."
cat > /etc/nginx/sites-available/slush-app << 'NGINXEOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name slushdating.co.uk www.slushdating.co.uk slushdating.com www.slushdating.com;
    return 301 https://www.slushdating.com$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name slushdating.co.uk www.slushdating.co.uk slushdating.com www.slushdating.com;

    # SSL configuration (certificates will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/slushdating.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/slushdating.co.uk/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # API proxy - must come before /app location
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Socket.IO proxy - must come before /app location
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }

    # Static uploads - must come before /app location
    location /uploads/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend app and assets at /app subpath
    location /app/ {
        alias /root/slush-app/dist/;
        index index.html;
        
        # For SPA routing - if file not found, serve index.html
        if (!-e $request_filename) {
            rewrite ^ /app/index.html last;
        }
    }

    # Handle /app without trailing slash
    location = /app {
        return 301 $scheme://$host/app/;
    }

    # Root location - serve marketing site
    location = / {
        root /root/slush-app/marketing;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Default location (fallback) - serve marketing site
    location / {
        root /root/slush-app/marketing;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# Enable site and disable default/conflicting configs
ln -sf /etc/nginx/sites-available/slush-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/www-slushdating-com
rm -f /etc/nginx/sites-enabled/slushdating-com
rm -f /etc/nginx/sites-enabled/www.slushdating.com
rm -f /etc/nginx/sites-enabled/slushdating.com

# Setup SSL certificate
echo "🔒 Setting up SSL certificate..."
echo "⚠️  IMPORTANT: Ensure DNS is configured to point www.slushdating.com to this server (80.190.80.106)"
echo "⚠️  After DNS propagation, run: certbot --nginx -d slushdating.com -d www.slushdating.com --non-interactive --agree-tos --email your-email@example.com"

# For now, create a self-signed certificate for testing
mkdir -p /etc/ssl/certs /etc/ssl/private
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/selfsigned.key \
    -out /etc/ssl/certs/selfsigned.crt \
    -subj "/C=GB/ST=England/L=London/O=Slush Dating/CN=slushdating.co.uk"

# Update nginx config to use self-signed cert temporarily
sed -i 's|ssl_certificate /etc/letsencrypt/live/slushdating.co.uk/fullchain.pem;|ssl_certificate /etc/ssl/certs/selfsigned.crt;|g' /etc/nginx/sites-available/slush-app
sed -i 's|ssl_certificate_key /etc/letsencrypt/live/slushdating.co.uk/privkey.pem;|ssl_certificate_key /etc/ssl/private/selfsigned.key;|g' /etc/nginx/sites-available/slush-app

nginx -t
systemctl restart nginx
systemctl enable nginx

# Start the application with PM2
echo "🚀 Starting application with PM2..."
cd ~/slush-app/server
pm2 start index.js --name "slush-server"
pm2 save
pm2 startup

# Setup firewall
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your app will be available at:"
echo "   - https://www.slushdating.com/app/"
echo "   - https://slushdating.com/app (redirects to www)"
echo "   - https://www.slushdating.co.uk/app (redirects to /app/)"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure DNS A record for www.slushdating.com points to 80.190.80.106"
echo "   2. Wait for DNS propagation (can take up to 48 hours)"
echo "   3. Run SSL certificate setup:"
echo "      certbot --nginx -d slushdating.com -d www.slushdating.com --non-interactive --agree-tos --email your-email@example.com"
echo "   4. After SSL is configured, restart nginx: systemctl restart nginx"
echo ""
echo "🔧 Useful commands:"
echo "  pm2 restart slush-server    # Restart the server"
echo "  pm2 logs slush-server       # View logs"
echo "  pm2 monit                   # Monitor processes"
echo "  nginx -t                    # Test nginx config"
echo "  systemctl restart nginx     # Restart nginx"
echo "  systemctl status nginx       # Check nginx status"

