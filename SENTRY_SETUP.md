# Sentry Setup for Momma B's Scanner

Sentry is configured for error tracking and performance monitoring.

## Setup

1. Create a Sentry account at https://sentry.io
2. Create a new React Native project in Sentry
3. Copy your DSN from the project settings
4. Add to `app.json` in the `extra` section:
   ```json
   "extra": {
     "EXPO_PUBLIC_SENTRY_DSN": "https://your-sentry-dsn-here@sentry.io/your-project-id"
   }
   ```

## Configuration

- **Initialization**: `app/_layout.tsx` - Sentry.init() at app startup
- **Error Boundary**: `components/ScannerErrorBoundary.tsx` - Automatic error capture

## Features Enabled

- Error tracking (100% of errors)
- Performance monitoring (10% sample rate)
- Environment tagging (development/production)
- React component error boundaries
- Debug logging in development mode

## Testing

To test Sentry is working:

1. Add your DSN to `app.json`
2. Rebuild the app: `eas build --platform ios --profile development`
3. Run the app and trigger an error (e.g., scan an invalid barcode)
4. Check your Sentry dashboard for the error

## Production

For production builds via EAS:

1. Add `EXPO_PUBLIC_SENTRY_DSN` to EAS secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-dsn-here"
   ```
2. Update `app.json` to use the secret:
   ```json
   "extra": {
     "EXPO_PUBLIC_SENTRY_DSN": "$EXPO_PUBLIC_SENTRY_DSN"
   }
   ```
3. Build with: `eas build --platform ios --profile production`

Sentry will automatically track errors and crashes in production.
