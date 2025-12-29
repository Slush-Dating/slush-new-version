#!/bin/bash

# Slush Dating iOS Version Increment Script
# This script updates all necessary files for iOS TestFlight builds

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to increment version number
increment_version() {
    local version=$1
    local part=$2

    # Split version into parts
    IFS='.' read -ra VERSION_PARTS <<< "$version"

    case $part in
        major)
            VERSION_PARTS[0]=$((VERSION_PARTS[0] + 1))
            VERSION_PARTS[1]=0
            VERSION_PARTS[2]=0
            ;;
        minor)
            VERSION_PARTS[1]=$((VERSION_PARTS[1] + 1))
            VERSION_PARTS[2]=0
            ;;
        patch)
            VERSION_PARTS[2]=$((VERSION_PARTS[2] + 1))
            ;;
        *)
            print_error "Invalid version part: $part. Use major, minor, or patch."
            exit 1
            ;;
    esac

    echo "${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.${VERSION_PARTS[2]}"
}

# Function to update plist file
update_plist() {
    local plist_file=$1
    local key=$2
    local value=$3

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use plutil
        plutil -replace "$key" -string "$value" "$plist_file"
    else
        # Linux/other - use sed (basic plist manipulation)
        # This is a simplified approach - for complex plists, consider using a proper plist parser
        sed -i.bak "s|<key>$key</key>.*<string>[^<]*</string>|<key>$key</key>\n\t<string>$value</string>|g" "$plist_file"
    fi

    print_success "Updated $key to $value in $plist_file"
}

# Function to update JSON file
update_json() {
    local json_file=$1
    local key=$2
    local value=$3

    # Use sed to update JSON (simple approach for version strings)
    sed -i.bak "s|\"$key\": \"[^\"]*\"|\"$key\": \"$value\"|g" "$json_file"

    print_success "Updated $key to $value in $json_file"
}

# Main script
main() {
    # Check if we're in the right directory
    if [[ ! -f "app.json" ]] || [[ ! -f "package.json" ]]; then
        print_error "Please run this script from the apps/native directory"
        exit 1
    fi

    print_status "Slush Dating iOS Version Increment Script"
    print_status "========================================"

    # Get current versions
    CURRENT_VERSION=$(grep '"version"' app.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
    CURRENT_BUILD=$(grep -A 2 '<key>CFBundleVersion</key>' ios/SlushDating/Info.plist | grep '<string>' | sed 's/.*<string>\([^<]*\)<\/string>.*/\1/')

    print_status "Current version: $CURRENT_VERSION"
    print_status "Current build: $CURRENT_BUILD"
    echo

    # Ask user what to do
    echo "What would you like to do?"
    echo "1) Increment build number only (for TestFlight builds)"
    echo "2) Increment patch version (e.g., 2.0.2 → 2.0.3)"
    echo "3) Increment minor version (e.g., 2.0.2 → 2.1.0)"
    echo "4) Increment major version (e.g., 2.0.2 → 3.0.0)"
    echo "5) Set custom version"
    echo
    read -p "Enter your choice (1-5): " choice

    case $choice in
        1)
            # Just increment build number
            NEW_BUILD=$((CURRENT_BUILD + 1))
            NEW_VERSION=$CURRENT_VERSION
            print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"
            ;;
        2)
            # Increment patch version
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "patch")
            NEW_BUILD=$((CURRENT_BUILD + 1))
            print_status "Incrementing patch version: $CURRENT_VERSION → $NEW_VERSION"
            print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"
            ;;
        3)
            # Increment minor version
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "minor")
            NEW_BUILD=$((CURRENT_BUILD + 1))
            print_status "Incrementing minor version: $CURRENT_VERSION → $NEW_VERSION"
            print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"
            ;;
        4)
            # Increment major version
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "major")
            NEW_BUILD=$((CURRENT_BUILD + 1))
            print_status "Incrementing major version: $CURRENT_VERSION → $NEW_VERSION"
            print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"
            ;;
        5)
            # Custom version
            read -p "Enter new version number (e.g., 2.1.0): " NEW_VERSION
            NEW_BUILD=$((CURRENT_BUILD + 1))
            print_status "Setting custom version: $NEW_VERSION"
            print_status "Incrementing build number: $CURRENT_BUILD → $NEW_BUILD"
            ;;
        *)
            print_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac

    echo
    print_warning "About to make the following changes:"
    echo "  - Version: $CURRENT_VERSION → $NEW_VERSION"
    echo "  - Build: $CURRENT_BUILD → $NEW_BUILD"
    echo
    read -p "Continue? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled."
        exit 0
    fi

    # Update files
    print_status "Updating files..."

    # Update Info.plist
    update_plist "ios/SlushDating/Info.plist" "CFBundleShortVersionString" "$NEW_VERSION"
    update_plist "ios/SlushDating/Info.plist" "CFBundleVersion" "$NEW_BUILD"

    # Update app.json and package.json if version changed
    if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
        update_json "app.json" "version" "$NEW_VERSION"
        update_json "package.json" "version" "$NEW_VERSION"
    fi

    echo
    print_success "Version increment complete!"
    print_status "New version: $NEW_VERSION"
    print_status "New build: $NEW_BUILD"
    echo
    print_status "You can now build for TestFlight with:"
    print_status "  eas build --platform ios --profile production"
    echo
    print_warning "Remember to commit these changes:"
    print_warning "  git add app.json package.json ios/SlushDating/Info.plist"
    print_warning "  git commit -m \"Bump version to $NEW_VERSION ($NEW_BUILD)\""
}

# Run main function
main "$@"

