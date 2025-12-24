#!/bin/bash

# Fix iOS Swift Package Manager issues
# This script cleans and resets the Xcode project to resolve package dependency issues

set -e

echo "🔧 Fixing iOS Swift Package Manager issues..."

# Clean build artifacts
echo "🧹 Cleaning iOS build artifacts..."
rm -rf ios/App/build/
rm -rf ios/App/DerivedData/

# Remove Xcode cache
echo "🗑️  Removing Xcode cache..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*

# Clean and re-sync Capacitor
echo "🔄 Re-syncing Capacitor iOS..."
CAPACITOR_HOSTNAME=staging.slushdating.com npx cap sync ios

# Reset Swift Package Manager
echo "📦 Resetting Swift Package Manager..."
if command -v xcodebuild >/dev/null 2>&1; then
    cd ios/App
    if [ -f "App.xcworkspace/contents.xcworkspacedata" ]; then
        echo "🔄 Resolving package dependencies..."
        xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App || echo "⚠️  xcodebuild failed, but Xcode should resolve packages when opened"
    else
        echo "⚠️  Xcode workspace not found, packages will be resolved when Xcode opens"
    fi
    cd ../..
else
    echo "⚠️  xcodebuild not found, packages will be resolved when Xcode opens"
fi

echo ""
echo "✅ iOS packages cleaned and re-synced!"
echo ""
echo "📱 Next steps:"
echo "1. Open Xcode with latest staging code:"
echo "   npm run build:ios:staging"
echo ""
echo "2. If you still see package errors in Xcode, try these steps:"
echo "   - Xcode → File → Packages → Reset Package Caches"
echo "   - Xcode → File → Packages → Resolve Package Versions"
echo "   - Clean Build Folder: Xcode → Product → Clean Build Folder"
echo "   - Close Xcode completely, reopen, and try building again"
echo ""
echo "3. Alternative: Delete derived data manually"
echo "   rm -rf ~/Library/Developer/Xcode/DerivedData/*"
echo ""
echo "The CapacitorHaptics package should now be properly resolved! 🎯"
