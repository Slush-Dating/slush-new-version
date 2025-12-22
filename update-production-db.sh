#!/bin/bash

echo "🔄 Updating production server to use MongoDB Atlas..."

# SSH into the VPS and update the .env file
ssh root@80.190.80.106 << 'EOF'
cd ~/slush-app/server

# Backup current .env
cp .env .env.backup

# Update .env with Atlas connection
cat > .env << 'ENVEOF'
PORT=5001
HOST=0.0.0.0
MONGODB_URI=mongodb+srv://virtualspeeddate1_db_user:NRvKXCsUqnbUKw4P@cluster0.a9ozntt.mongodb.net/slush?retryWrites=true&w=majority
NODE_ENV=production
ENVEOF

echo "✅ Updated .env file with Atlas connection"

# Restart the server
pm2 restart slush-server

echo "🚀 Server restarted with new Atlas configuration"
echo "📊 Check logs with: pm2 logs slush-server"
EOF

echo "🎉 Production server updated! Test login at http://80.190.80.106/"

