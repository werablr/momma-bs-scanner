# Momma B's Scanner - Handoff

**App:** React Native (iPhone)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning + AI vision

---

## Current State

### Working
- Authentication & RLS (secure login, household-based isolation)
- Barcode scanning (UPC/EAN via camera)
- AI Vision (OpenAI GPT-4o identifying produce)
- Multi-API integration (Open Food Facts + UPCitemdb + USDA)
- Photo uploads (Supabase Storage)
- Manual entry fallback
- OCR + manual date picker for expiration
- Edge function security (JWT auth, CORS restricted)

### Issues
- AI Vision UI incomplete (backend works, need product selection screen)
- Metro auto-connect requires manual URL entry (192.168.0.211:8081)

---

## Workflows

### 1. Barcode (Packaged Goods)
1. Scan barcode → select storage location
2. Edge function queries: Product Catalog (cache) → Open Food Facts → UPCitemdb
3. OCR expiration date (or manual entry)
4. Review screen → save to database

### 2. AI Vision (Produce/Bulk)
1. "Scan by Photo" → camera captures image
2. OpenAI GPT-4 Vision identifies item
3. USDA + Open Food Facts searched in parallel
4. User selects match → storage location + expiration
5. Generates `PHOTO-{timestamp}` barcode

### 3. Manual Entry
- User types product name, brand, details
- Generates `MANUAL-{timestamp}` barcode

---

## Deployment

**Daily Development:**
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
npx expo start --dev-client
```

**Native Rebuild (permissions, native modules):**
```bash
eas build --platform ios --profile development
```
Never use `npx expo run:ios` - CocoaPods fails

**Deploy Edge Functions:**
```bash
supabase functions deploy scanner-ingest
supabase functions deploy identify-by-photo
```

---

## TestFlight
- App Store Connect configured (App ID: 6754896169)
- Privacy policy: https://werablr.github.io/momma-bs-scanner/PRIVACY_POLICY.md
- Internal tester: werablr@gmail.com

---

## Troubleshooting

**Metro Won't Auto-Connect:**
- Tap "Enter URL manually" → `192.168.0.211:8081`
- Fix: Rebuild with EAS (permissions in app.json already added)

**Expected Behaviors (Not Bugs):**
- Product not found: Normal for QR codes, non-UPC barcodes
- OCR fails: Expected for embossed/stamped text
- Manual entry needed: By design for items without barcodes
