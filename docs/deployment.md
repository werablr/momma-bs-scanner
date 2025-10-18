# Scanner Module - iOS Deployment Guide

**Complete deployment guide for the Momma B's Household Scanner mobile app**

---

## Prerequisites

### Required Apple Developer Account
**⚠️ CRITICAL REQUIREMENT**: You MUST have an active Apple Developer Program subscription to deploy this app to production or even TestFlight.

- **Cost**: $99/year (USD)
- **Required for**: App Store deployment, TestFlight distribution, production certificates
- **Already configured**: Apple Team ID `9VXGGDHF22` (werablr account)
- **Renewal**: Annual subscription must be maintained for app to remain available

**Why this is required:**
- Apple requires paid developer accounts for any app distribution beyond local development
- Without it, you cannot deploy to TestFlight or App Store
- Even internal enterprise distribution requires the subscription
- This became mandatory when transitioning from development to production

### Development Environment (Apple-focused)
- **macOS**: Required for iOS development and deployment
- **Xcode**: Latest version from App Store
- **Xcode Command Line Tools**: `xcode-select --install`
- **Node.js**: v18 or later
- **Expo CLI**: `npm install -g @expo/cli`
- **EAS CLI**: `npm install -g eas-cli`

---

## Project Configuration

### Current Setup Status ✅
Your scanner app is already configured with:

```json
// app.json - iOS Configuration
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.nutritionscanner.app",
  "buildNumber": "1",
  "appleTeamId": "9VXGGDHF22",  // ← Your paid developer account
  "infoPlist": {
    "NSCameraUsageDescription": "This app uses the camera to scan product barcodes for nutrition tracking.",
    "NSPhotoLibraryUsageDescription": "This app may access your photo library to scan barcodes from images.",
    "UIBackgroundModes": ["background-processing"],
    "ITSAppUsesNonExemptEncryption": false
  }
}
```

### Environment Variables
Ensure your `.env` file contains:
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Deployment Process

### 1. Pre-Deployment Verification
```bash
# Navigate to scanner module
cd modules/scanner

# Verify dependencies are installed
npm install

# REQUIRED: Prebuild native projects with vision-camera
npx expo prebuild --clean

# Install iOS dependencies
cd ios && pod install && cd ..

# Test local build
npx expo run:ios

# Verify app.json configuration
cat app.json | grep -A 10 '"ios"'
```

### Camera Library Architecture
**CRITICAL**: This app uses `react-native-vision-camera` exclusively for:
- ✅ Barcode scanning (via vision-camera-code-scanner)
- ✅ OCR text recognition (via @react-native-ml-kit/text-recognition)

**Required Dependencies**:
```json
{
  "react-native-vision-camera": "^4.7.0",
  "vision-camera-code-scanner": "^0.2.0",
  "react-native-worklets": "^0.5.1",
  "@react-native-ml-kit/text-recognition": "^1.5.2"
}
```

**Why Vision Camera**:
- OCR capability is CRITICAL for expiration date scanning
- Single camera library prevents conflicts
- Works seamlessly with EAS Build and production deployment
- expo-camera was removed as it cannot support ML Kit OCR

**Deployment Requirement**: Must run `npx expo prebuild` before every build

### 2. EAS Build Setup
```bash
# Initialize EAS (if not already done)
eas login
eas build:configure

# Verify build configuration
cat eas.json
```

### 3. Production Build
```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Build for TestFlight (if you have a preview profile)
eas build --platform ios --profile preview
```

### 4. App Store Deployment

#### Option A: EAS Submit (Recommended)
```bash
# Submit directly to App Store Connect
eas submit --platform ios
```

#### Option B: Manual Upload
1. Download the `.ipa` file from EAS Build
2. Open **Transporter** app (from App Store)
3. Drag and drop the `.ipa` file
4. Wait for processing and validation

### 5. App Store Connect Configuration
1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to your app (Nutrition Scanner)
3. Configure:
   - App Information
   - Pricing and Availability
   - App Review Information
   - Version Information
   - Screenshots (required)

---

## Testing & Distribution

### TestFlight Distribution
```bash
# Build for TestFlight
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios --platform=ios
```

### Internal Testing
- TestFlight allows up to 100 internal testers
- Internal builds don't require App Review
- Perfect for household testing before public release

### External Testing (if needed)
- External TestFlight testing requires App Review
- Up to 10,000 external testers
- Same review process as App Store

---

## Version Management

### Updating App Version
```bash
# Update version in app.json
# Increment buildNumber for iOS builds
# Update version for major releases

# Example app.json updates:
"version": "1.0.1",           # User-visible version
"buildNumber": "2"            # iOS-specific build number
```

### Build Numbers
- **Must increment** for each App Store submission
- Current build number: `1`
- Next submission should be `2`, then `3`, etc.

---

## Cost Breakdown

### Required Costs
- **Apple Developer Program**: $99/year (already paid)
- **EAS Build**: Free tier covers most usage
- **App Store**: No additional fees for distribution

### Optional Costs
- **EAS Pro**: $99/month (only if you need more builds)
- **Premium Certificates**: Not required for basic distribution

---

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear Expo cache
npx expo install --fix

# Clear EAS cache
eas build --clear-cache --platform ios
```

#### Certificate Issues
- Ensure Apple Team ID is correct in `app.json`
- Verify Apple Developer subscription is active
- Check certificate expiration in App Store Connect

#### App Store Rejection
- Camera usage descriptions are already configured
- Privacy policy may be required for App Store review
- Ensure app functions without crashing on clean install

### Apple Developer Account Issues
- **Subscription expired**: Renew at [developer.apple.com](https://developer.apple.com)
- **Team ID changes**: Update in `app.json` and rebuild
- **Certificate conflicts**: Revoke and regenerate in App Store Connect

---

## Success Checklist

### Pre-Submission ✅
- [ ] Apple Developer subscription active ($99/year)
- [ ] App builds successfully with `eas build`
- [ ] Team ID configured: `9VXGGDHF22`
- [ ] Bundle identifier unique: `com.nutritionscanner.app`
- [ ] Camera permissions properly described
- [ ] App tested on physical iOS device

### App Store Connect ✅
- [ ] App created in App Store Connect
- [ ] Screenshots uploaded (required)
- [ ] App description and metadata complete
- [ ] Privacy policy URL (if required by review)
- [ ] Age rating configured appropriately

### Post-Deployment ✅
- [ ] TestFlight testing completed
- [ ] App Store review passed
- [ ] App available for download
- [ ] Analytics configured (optional)

---

## Additional Resources

### Apple Documentation
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [iOS App Distribution Guide](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

### Expo Documentation
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [App Store Deployment](https://docs.expo.dev/submit/ios/)

### Supabase Integration
- Environment variables properly configured
- Database connection tested in production build
- Authentication flow verified on iOS

---

**Last Updated**: September 29, 2025
**Apple Developer Account**: Active (werablr - 9VXGGDHF22)
**Current Build**: v1.0.0 (Build 1)