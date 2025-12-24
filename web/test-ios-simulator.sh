#!/bin/bash

echo "🚀 Testing Slush App in iOS Simulator"
echo ""

# Get local IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "📍 Local IP: $LOCAL_IP"
echo "🌐 App URL: http://$LOCAL_IP:5175"
echo ""

# Start simulator if not running
echo "📱 Starting iOS Simulator..."
open -a Simulator

# Wait for simulator to start
sleep 5

echo ""
echo "🔗 To test the app in Safari:"
echo "1. In the simulator, open Safari"
echo "2. Navigate to: http://$LOCAL_IP:5175"
echo ""
echo "🔐 For login testing, the server should be accessible at:"
echo "   API: http://$LOCAL_IP:5001/api"
echo ""
echo "✅ The fixes applied:"
echo "   - iOS-specific CSS optimizations for smoother transitions"
echo "   - Enhanced JWT error handling for login issues"
echo "   - Capacitor iOS configuration improvements"
echo ""
echo "🧪 Test the following:"
echo "   - Login functionality (should not show 'string did not match' error)"
echo "   - Screen transitions between auth flow and main app"
echo "   - Navigation between tabs in the main app"
echo ""

# Keep script running to show instructions
echo "Press Ctrl+C to exit..."
trap 'echo ""; echo "👋 Simulator testing complete!"' INT
while true; do sleep 1; done
