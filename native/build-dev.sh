#!/bin/bash
# Development build script with capability sync disabled
export EXPO_NO_CAPABILITY_SYNC=1
eas build --profile development --platform ios

