#!/bin/bash

echo "🔧 Setting up SSH access to Slush Dating server"
echo "================================================"

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass is not installed"
    echo ""
    echo "Install sshpass:"
    echo "  macOS: brew install hudochenkov/sshpass/sshpass"
    echo "  Ubuntu/Debian: sudo apt install sshpass"
    echo "  CentOS/RHEL: sudo yum install sshpass"
    echo ""
    exit 1
fi

echo "✅ sshpass is installed"

# Check if environment file exists
if [ ! -f "ssh-env.sh" ]; then
    echo ""
    echo "📝 Creating SSH environment file..."
    cp ssh-env-example.sh ssh-env.sh
    echo "✅ Created ssh-env.sh"
    echo ""
    echo "⚠️  IMPORTANT: Edit ssh-env.sh and set your actual server password!"
    echo "   nano ssh-env.sh"
    echo "   or"
    echo "   code ssh-env.sh"
else
    echo "✅ SSH environment file exists"
fi

# Load environment variables
if [ -f "ssh-env.sh" ]; then
    source ssh-env.sh
    echo "✅ Environment variables loaded"
else
    echo "❌ ssh-env.sh not found"
    exit 1
fi

# Check if password is set
if [ -z "$VPS_PASSWORD" ] || [ "$VPS_PASSWORD" = "your_server_password_here" ]; then
    echo ""
    echo "❌ VPS_PASSWORD is not set or using default value"
    echo "   Edit ssh-env.sh and set your actual server password"
    exit 1
fi

# Test SSH connection
echo ""
echo "🧪 Testing SSH connection to $VPS_USER@$VPS_HOST..."

if sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $VPS_USER@$VPS_HOST "echo 'SSH connection successful'" 2>/dev/null; then
    echo "✅ SSH connection successful!"
    echo ""
    echo "🎉 Setup complete! You can now use:"
    echo "   ./ssh-to-server.sh              # Interactive SSH session"
    echo "   ./ssh-to-server.sh 'ls -la'     # Run commands remotely"
    echo "   ./ssh-to-server.sh 'pm2 status' # Check server status"
else
    echo "❌ SSH connection failed"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check your password in ssh-env.sh"
    echo "2. Verify server is accessible: ping $VPS_HOST"
    echo "3. Check if SSH service is running on the server"
    exit 1
fi
