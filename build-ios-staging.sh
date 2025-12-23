#!/bin/bash

# iOS Staging Build Script
# Ensures IPA builds use the latest staging code from develop branch

set -e  # Exit on any error

echo "🚀 Building iOS IPA with latest staging code..."

# Check if we're on develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "❌ Not on develop branch. Switching to develop to ensure latest staging code..."
    git checkout develop
    git pull origin develop
    echo "✅ Switched to develop branch and pulled latest changes"
else
    echo "✅ Already on develop branch. Pulling latest changes..."
    git pull origin develop
fi

# Clean any previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf ios/App/build/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build React app for staging
echo "🔨 Building React app for staging..."
npm run build:staging

# Set staging hostname and sync with iOS
echo "🔄 Syncing with Capacitor iOS (staging configuration)..."
CAPACITOR_HOSTNAME=staging.slushdating.com npx cap sync ios

echo ""
echo "✅ iOS build complete!"
echo ""
echo "📱 Next steps for creating IPA:"
echo "1. Open Xcode: npx cap open ios"
echo "2. In Xcode:"
echo "   - Select 'App' target"
echo "   - Go to Product → Archive"
echo "   - Wait for archive to complete"
echo "   - Click 'Distribute App'"
echo "   - Choose 'App Store Connect' → 'Upload'"
echo "   - Select your development team"
echo "   - Upload to App Store Connect"
echo ""
echo "🌐 This build will connect to: staging.slushdating.com"
echo "📊 It will use the staging database and environment"
echo ""
echo "⚠️  IMPORTANT: Make sure you're signed into Xcode with:"
echo "   Apple ID: khalil.kirkwood@hotmail.co.uk"
echo "   And have the correct provisioning profiles set up"
