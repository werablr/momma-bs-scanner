# Scanner Module - Mobile Barcode Scanner

**React Native mobile app for household inventory management via barcode scanning**

---

## Overview

The Scanner module is a React Native/Expo mobile application that allows you to scan product barcodes, automatically look up nutritional information, and add items to your household inventory. It integrates seamlessly with the Momma B's Household Management System's Supabase backend.

### Key Features
- **Barcode Scanning**: Real-time UPC/EAN barcode recognition via vision-camera
- **OCR Expiration Dates**: ML Kit text recognition for automatic expiration date capture
- **Multi-Source Data**: Automatic lookup via Open Food Facts, UPCitemdb, and USDA APIs
- **AI Vision**: OpenAI GPT-4 Vision for produce/bulk item identification
- **Inventory Integration**: Direct sync with household inventory system
- **Offline Capability**: Scan items offline, sync when connected
- **Storage Locations**: Assign items to pantry, freezer, etc.
- **Authentication**: Secure household-based user management

### Camera Architecture
**Vision Camera System** (react-native-vision-camera v4.7.0)
- ✅ Unified camera implementation for all features
- ✅ Barcode scanning via vision-camera-code-scanner plugin
- ✅ OCR text recognition via ML Kit (@react-native-ml-kit/text-recognition)
- ✅ Production-ready with EAS Build support

**Why Vision Camera**: OCR capability for expiration date scanning is CRITICAL. expo-camera was removed as it cannot support ML Kit integration.

---

## Prerequisites

### ⚠️ Apple Developer Subscription Required
**For iOS deployment to production, you MUST have:**
- Active Apple Developer Program subscription ($99/year USD)
- **Status**: ✅ Already configured (Apple Team ID: 9VXGGDHF22)
- **Required for**: App Store deployment, TestFlight, production certificates
- **Why needed**: Apple requires paid accounts for any app distribution beyond local development

### Development Environment
- **macOS**: Required for iOS development
- **Xcode**: Latest version from App Store
- **Node.js**: v18 or later
- **Expo CLI**: `npm install -g @expo/cli`
- **iOS Simulator** or **physical iOS device** for testing

### API Keys Required
- **Supabase**: Project URL and anon key (configured in `.env`)
- **Server-side APIs** (configured in Supabase Secrets): OpenAI, USDA

---

## Quick Start

### 1. Installation
```bash
# Navigate to scanner module
cd modules/scanner

# Install dependencies
npm install

# REQUIRED: Prebuild native projects (vision-camera needs native code)
npx expo prebuild --clean

# Install iOS CocoaPods
cd ios && pod install && cd ..

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Development
```bash
# Start Expo development server
npx expo start

# Run on iOS simulator (requires prebuild first)
npx expo run:ios

# Run on connected iOS device
npx expo run:ios --device

# Note: Cannot use Expo Go - development build required for vision-camera
```

### 3. Testing
```bash
# Test barcode scanning functionality
# Test user authentication flow
# Test inventory item creation
# Verify Supabase integration
```

---

## Configuration

### Environment Variables (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### App Configuration (app.json)
```json
{
  "expo": {
    "name": "Momma B's Scanner",
    "slug": "momma-bs-scanner",
    "bundleIdentifier": "com.mommabsscanner.app",
    "ios": {
      "appleTeamId": "9VXGGDHF22"
    }
  }
}
```

---

## Architecture

### Core Components
- **AuthScreen**: User authentication and household selection
- **ScannerScreen**: Main barcode scanning interface
- **ReviewScreen**: Item review and confirmation
- **HistoryScreen**: Scan history and item management

### Services
- **supabase.js**: Database client and authentication
- **scannerAPI.js**: API layer for inventory operations

### Data Flow
1. User scans barcode → Camera captures UPC/EAN code
2. App queries multiple APIs → Retrieves product information (OFF, UPC, USDA)
3. User reviews and confirms → Assigns storage location
4. Data sent to Supabase → Updates household inventory

### AI Vision Flow (for produce/bulk items)
1. User captures photo → Uploads to Supabase Storage
2. OpenAI GPT-4 Vision identifies item → Returns name and confidence
3. USDA + Open Food Facts searched in parallel → Returns nutrition data
4. User selects best match → Assigns storage location
5. Data sent to Supabase → Updates household inventory

---

## Deployment

### iOS App Store Deployment
**📚 See [deployment.md](docs/deployment.md) for complete guide**

Key points:
- Apple Developer subscription required ($99/year) ✅
- Use EAS Build for production builds
- Submit via EAS Submit or Transporter app
- TestFlight available for beta testing

### Quick Deploy Commands
```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios

# Build for TestFlight
eas build --platform ios --profile preview
```

---

## Integration Points

### Supabase Database
- **Authentication**: User accounts and household management
- **Inventory**: Real-time inventory updates
- **History**: Scan history and item tracking
- **Edge Functions**: Server-side barcode processing

### Multi-Source APIs
- **Open Food Facts**: Product data, nutrition, health scores (unlimited free)
- **UPCitemdb**: Package sizes, pricing (100/day free)
- **USDA FoodData Central**: Fresh produce nutrition (free with API key)
- **OpenAI GPT-4 Vision**: AI-powered item identification
- **Brand Information**: Product names and manufacturers

### Other Modules
- **inventory-manager**: Web interface shows scanned items
- **recipes**: Recipe planning uses inventory data
- **MommaBsKiosk**: Kitchen display shows inventory status

---

## Development Status

### ✅ Completed Features
- Barcode scanning with camera
- User authentication system
- Supabase database integration
- Multi-source API integration (Open Food Facts, UPCitemdb, USDA)
- AI Vision integration (OpenAI GPT-4)
- iOS app configuration
- Apple Developer account setup

### 🔄 In Progress
- Enhanced UI/UX improvements
- Offline scanning capabilities
- Advanced inventory categorization
- Integration testing with other modules

### 📋 Planned Features
- Android support (future)
- Voice commands for scanning
- OCR for expiration date scanning
- Inventory level warnings

---

## Troubleshooting

### Common Issues

#### Camera Not Working
- Check camera permissions in iOS Settings
- Verify `NSCameraUsageDescription` in app.json
- Test on physical device (simulator camera limited)

#### Authentication Failures
- Verify Supabase credentials in `.env`
- Check Supabase project URL and anon key
- Ensure RLS policies allow household access

#### Build Failures
```bash
# Clear caches and reinstall
npx expo install --fix
rm -rf node_modules && npm install

# Clear EAS cache
eas build --clear-cache --platform ios
```

#### Deployment Issues
- Ensure Apple Developer subscription is active
- Verify Apple Team ID in app.json
- Check certificate expiration in App Store Connect

---

## File Structure
```
scanner/
├── app/                     # Expo Router pages
│   ├── (tabs)/             # Tab navigation
│   └── _layout.tsx         # Root layout with auth
├── components/             # Reusable UI components
│   ├── AuthScreen.js       # Authentication interface
│   ├── BarcodeScanner.jsx  # Camera scanning component
│   └── ProductInfo.jsx     # Product display
├── contexts/               # React contexts
│   └── AuthContext.js      # Authentication state
├── services/               # API integrations
│   ├── scannerAPI.js       # Inventory API layer
│   └── ocrService.js       # ML Kit OCR integration
├── lib/                    # Core utilities
│   └── supabase.js         # Database client
├── docs/                   # Documentation
│   └── deployment.md       # Deployment guide
├── .env                    # Environment variables
├── app.json               # Expo configuration
└── package.json           # Dependencies
```

---

## Cost Breakdown

### Required Costs
- **Apple Developer Program**: $99/year ✅ (already paid)

### Optional Costs
- **EAS Pro**: $99/month (only if heavy building needed)
- **OpenAI API**: Pay-per-use for AI Vision (GPT-4 Vision ~$0.01-0.03 per image)

### Free Tier Limits
- **EAS Build**: Sufficient for most development
- **Supabase**: Covers household-scale usage
- **Open Food Facts**: Unlimited free
- **UPCitemdb**: 100 requests/day free
- **USDA FoodData Central**: Free with API key

---

## Support & Documentation

### Internal Documentation
- **[deployment.md](docs/deployment.md)**: Complete iOS deployment guide
- **Main README.md**: System overview and architecture
- **GOVERNANCE.md**: System standards and expansion guidelines

### External Resources
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Open Food Facts API](https://world.openfoodfacts.org/data)
- [UPCitemdb API](https://devs.upcitemdb.com/)
- [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide.html)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

**Module Status**: ✅ Production Ready
**Last Updated**: September 29, 2025
**Apple Developer Account**: Active (Team ID: 9VXGGDHF22)