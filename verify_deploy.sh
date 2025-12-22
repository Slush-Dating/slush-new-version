#!/bin/bash
# 🏥 Slush Dating - Deployment Health Check
# Run this after any deployment to ensure critical routes are working.

DOMAIN="www.slushdating.com"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting Deployment Health Check for ${DOMAIN}...${NC}"

check_route() {
    local route=$1
    local expected_status=$2
    local name=$3

    echo -n "Checking ${name} (${route})... "
    status=$(curl -k -s -I "https://${DOMAIN}${route}" | grep HTTP | awk '{print $2}')

    if [[ "$status" == *"$expected_status"* ]]; then
        echo -e "${GREEN}✅ PASSED (${status})${NC}"
    else
        echo -e "${RED}❌ FAILED (Expected ${expected_status}, got ${status})${NC}"
    fi
}

# 1. API Events (Critical for App Functionality)
check_route "/api/events" "200" "API Events"

# 2. Admin Panel Redirect (Critical for Management)
check_route "/admin" "301" "Admin Redirect"

# 3. Main App Redirect
check_route "/app" "301" "App Redirect"

# 4. Marketing Site (Root)
echo -n "Checking Marketing Site (Root)... "
status=$(curl -k -s -I "https://${DOMAIN}/" | grep HTTP | awk '{print $2}')
if [[ "$status" == *"200"* || "$status" == *"301"* ]]; then
    echo -e "${GREEN}✅ PASSED (${status})${NC}"
else
    echo -e "${RED}❌ FAILED (${status})${NC}"
fi

echo -e "${BLUE}📋 Deployment verification complete.${NC}"
