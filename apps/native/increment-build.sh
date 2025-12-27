#!/bin/bash

# Quick build increment for TestFlight
# This script only increments the build number (CFBundleVersion)

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "ios/SlushDating/Info.plist" ]]; then
    echo "Please run this script from the apps/native directory"
    exit 1
fi

# Get current build number
CURRENT_BUILD=$(grep -A 2 '<key>CFBundleVersion</key>' ios/SlushDating/Info.plist | grep '<string>' | sed 's/.*<string>\([^<]*\)<\/string>.*/\1/')
NEW_BUILD=$((CURRENT_BUILD + 1))

print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"

# Update Info.plist
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use plutil
    plutil -replace "CFBundleVersion" -string "$NEW_BUILD" "ios/SlushDating/Info.plist"
else
    # Linux/other - use sed
    sed -i.bak "s|<key>CFBundleVersion</key>.*<string>[^<]*</string>|<key>CFBundleVersion</key>\n\t<string>$NEW_BUILD</string>|g" "ios/SlushDating/Info.plist"
fi

print_success "Build number updated to $NEW_BUILD"
print_status "Ready for TestFlight build!"
