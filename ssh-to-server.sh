#!/bin/bash

# SSH to Slush Dating Server
# Usage: ./ssh-to-server.sh [command]

# Server details
SERVER_HOST="80.190.80.106"
SERVER_USER="root"

# Check if password is set
if [ -z "$VPS_PASSWORD" ]; then
    echo "❌ Error: VPS_PASSWORD environment variable is not set"
    echo "   Set it with: export VPS_PASSWORD='your_password_here'"
    echo "   Or add it to your ~/.bashrc or ~/.zshrc file"
    exit 1
fi

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "❌ Error: sshpass is not installed"
    echo "   Install with: brew install hudochenkov/sshpass/sshpass"
    echo "   Or on Ubuntu/Debian: sudo apt install sshpass"
    exit 1
fi

# If no command provided, open interactive SSH session
if [ $# -eq 0 ]; then
    echo "🔗 Connecting to server..."
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST
else
    # Execute the provided command on the server
    echo "🔗 Executing command on server: $@"
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "$@"
fi
