# iOS Version Increment Scripts

This directory contains scripts to help you increment version numbers for iOS TestFlight builds.

## Files

- `increment-build.sh` - Quick script to increment only the build number (most common for TestFlight)
- `increment-version.sh` - Interactive script for incrementing version numbers and build numbers

## Quick Build Increment (Most Common)

For TestFlight builds, you typically only need to increment the build number:

```bash
cd apps/native
./increment-build.sh
```

This will:
- Increment the `CFBundleVersion` in `ios/SlushDating/Info.plist`
- Display the new build number

## Full Version Increment

For more control over version numbers, use the interactive script:

```bash
cd apps/native
./increment-version.sh
```

This script offers several options:
1. **Increment build number only** (for TestFlight builds)
2. **Increment patch version** (e.g., 2.0.2 → 2.0.3)
3. **Increment minor version** (e.g., 2.0.2 → 2.1.0)
4. **Increment major version** (e.g., 2.0.2 → 3.0.0)
5. **Set custom version**

The script updates:
- `CFBundleShortVersionString` and `CFBundleVersion` in `ios/SlushDating/Info.plist`
- `version` in `app.json` and `package.json` (when version changes)

## Workflow for TestFlight

1. Make your code changes
2. Run `./increment-build.sh` to increment the build number
3. Commit the changes:
   ```bash
   git add ios/SlushDating/Info.plist
   git commit -m "Bump build to 11"
   ```
4. Build for TestFlight:
   ```bash
   eas build --platform ios --profile production
   ```

## What Gets Updated

| File | Field | Purpose |
|------|-------|---------|
| `ios/SlushDating/Info.plist` | `CFBundleVersion` | Build number (increments for each TestFlight build) |
| `ios/SlushDating/Info.plist` | `CFBundleShortVersionString` | Version number (user-facing version) |
| `app.json` | `version` | Expo app version |
| `package.json` | `version` | NPM package version |

## Notes

- Build numbers (`CFBundleVersion`) should increment for each TestFlight build
- Version numbers (`CFBundleShortVersionString`) should increment when releasing new versions to the App Store
- The scripts work on both macOS (using `plutil`) and Linux (using `sed`)
- Always commit version changes before building
