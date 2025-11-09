# Momma B's Scanner - App-Specific Handoff

> **Part of Momma B's Household** → **Momma B's Kitchen**
>
> [Ecosystem Overview](../HANDOFF.md) | [Kitchen Subsystem](../Momma B's Kitchen/HANDOFF.md) | [Pantry App](../momma-bs-pantry/HANDOFF.md)

**App:** Scanner (React Native - Mobile)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning (OFF + UPC APIs only)
**Date:** November 9, 2025
**Status:** ✅ **WORKING** - Two-API Strategy (OFF + UPC), USDA Moved to Pantry App

---

## 🔄 ARCHITECTURAL CHANGE: USDA → Pantry App (Nov 9, 2025)

**Decision:** USDA enrichment removed from Scanner, moved to Pantry app

**Rationale:**
- **Scanner priority:** Speed and reliability during physical scanning workflow
- **USDA complexity:** Fuzzy matching is slow, requires user validation with desktop UI
- **User experience:** On-demand enrichment (user chooses when to add USDA data)
- **Separation of concerns:** Scanner = fast ingestion, Pantry = detailed validation

**What Changed:**
- ❌ **Removed:** All USDA API calls from `scanner-ingest` edge function
- ❌ **Removed:** USDA extraction functions (`extractUSDAProduct`, `extractUSDANutrition`)
- ❌ **Removed:** USDA fuzzy matching logic (Levenshtein distance, validation checks)
- ✅ **Kept:** All `usda_*` columns in database (set to NULL, Pantry will populate)
- ✅ **Kept:** `usda_match_validations` table (Pantry will use for validation workflow)

**Scanner Now Handles:**
- ✅ Barcode scanning
- ✅ Open Food Facts API (nutrition, photos, health scores, dietary flags)
- ✅ UPCitemdb API (package sizes, product names)
- ✅ Manual entry (no barcode products)

**Pantry Will Handle (Future):**
- 🔜 USDA data enrichment (on-demand, user-initiated)
- 🔜 Fuzzy matching with product name similarity
- 🔜 User validation of USDA matches (side-by-side comparison UI)
- 🔜 Micronutrient additions (Calcium, Iron, Potassium from USDA)

**See:** [Pantry HANDOFF.md](../momma-bs-pantry/HANDOFF.md) for USDA enrichment implementation plan

---

## ✅ SYSTEM OPERATIONAL (Nov 9, 2025)

**All Systems Working:**
- ✅ Two-API strategy operational (OFF + UPC)
- ✅ Barcode scanning functional
- ✅ Manual entry fixed - No longer requires barcode (generates `MANUAL-{timestamp}`)
- ✅ Edge function deployed and operational
- ✅ Data flowing from APIs → Database

**Current API Performance:**
- ✅ **Open Food Facts** - Working perfectly (nutrition, photos, health scores, dietary flags)
- ✅ **UPCitemdb** - Working perfectly (package sizes)

**Recent Session (Nov 9, 2025):**
- USDA logic removed from scanner (moved to Pantry app)
- Edge function redeployed successfully
- 10 items in inventory, ready for continued testing

---

## 🔄 UPDATED: Two-API Scanner Strategy (Nov 9, 2025)

**Previous:** Nutritionix subscription expired ($499/month), migrated to multi-API free sources
**Current:** Scanner uses OFF + UPC only, USDA moved to Pantry app

### Scanner API Architecture

**Philosophy: Fast and Reliable Data Ingestion**

Scanner prioritizes speed during physical scanning workflow. USDA enrichment (slow fuzzy matching + validation) deferred to Pantry app.

```
PRIORITY 1: Check product_catalog (cached data - skip APIs)

PRIORITY 2: UPCitemdb
   └─> FREE - 100 requests/day
   └─> Product names, brands, package sizes
   └─> Pricing data

PRIORITY 3: Open Food Facts
   └─> FREE - UNLIMITED
   └─> Health scores (Nutri-Score, NOVA)
   └─> Nutrition data
   └─> Photos, environmental data
   └─> Dietary flags (vegan, vegetarian)

PRIORITY 4: Manual entry fallback
```

**USDA FoodData Central** (moved to Pantry app):
- Not called during scanning (slow, requires validation)
- On-demand enrichment in Pantry app
- User-validated fuzzy matching with desktop UI

### Database Schema: Multi-Source Columns

**Design Principle:** Store ALL data sources separately, track provenance

**Schema Structure (per nutrient):**
```sql
-- Source-specific columns (track provenance)
usda_calories DECIMAL,  -- NULL from Scanner, populated by Pantry
off_calories DECIMAL,   -- Populated by Scanner
upc_calories DECIMAL,   -- Populated by Scanner

-- Single Source of Truth (displayed value)
nf_calories DECIMAL  -- Auto-selected: COALESCE(off, upc) in Scanner
                     -- Will become: COALESCE(user, usda, off, upc) after Pantry enrichment
```

**Benefits:**
- ✅ **Data provenance** - Know which API provided what
- ✅ **Quality comparison** - See discrepancies between sources
- ✅ **User override** - Let user pick trusted source per product
- ✅ **Analytics potential** - "Which API is most complete for X category?"
- ✅ **Future-proof** - Add new sources = just add columns
- ✅ **No data loss** - All sources preserved forever

**Migration Strategy:**
- Add columns: `usda_*`, `off_*` for all nutrients
- Keep existing `nf_*` columns as SSoT (backward compatible)
- Raw API responses: `usda_raw_data JSONB`, etc. (debugging)
- UPC alias tracking: `upc_aliases` table for cross-references

**Why Columns vs JSONB:**
- Simple SQL queries: `WHERE nf_calories > 100`
- Type safety: Database enforces DECIMAL
- Easy indexing for performance
- Clear schema: Know exactly what data exists
- No special syntax needed
- 40-50 columns is not a problem for modern databases

---


---

**Note:** USDA fuzzy matching documentation moved to [Pantry HANDOFF.md](../momma-bs-pantry/HANDOFF.md) where this feature will be implemented.

---

## ✅ TESTFLIGHT SETUP COMPLETE (Nov 6, 2025)

**Status:** All prerequisites complete, ready to build for TestFlight

**Completed (Nov 6, 2025 Session):**
1. ✅ **Security Hardening Complete**
   - All hardcoded credentials removed from codebase
   - `.env.example` sanitized (placeholders only)
   - `utils/constants.js` and `services/nutritionix.js` - no fallbacks, fail-fast validation
   - `HANDOFF.md` credentials replaced with `<stored_in_1password>`
   - `supabase/.temp/` removed from git tracking and gitignored
   - All secrets stored exclusively in 1Password and `.env` (gitignored)
   - Repository made public: https://github.com/werablr/momma-bs-scanner

2. ✅ **GitHub Pages Enabled**
   - Privacy policy hosted at: https://werablr.github.io/momma-bs-scanner/PRIVACY_POLICY.md
   - Repository visibility: Public

3. ✅ **App Store Connect Configured**
   - App ID: 6754896169
   - Name: "Momma B's Scanner"
   - Subtitle: "Kitchen Inventory Management"
   - Category: Food & Drink
   - Age Rating: Configured
   - Privacy Policy URL: Added
   - Internal tester added: werablr@gmail.com

4. ✅ **EAS Configuration Updated**
   - `eas.json` changed from "internal" to "store" distribution
   - iOS simulator disabled (physical device only)
   - Development client enabled (Metro bundler support)

5. ✅ **TestFlight App Installed**
   - TestFlight app installed on iPhone
   - Ready to receive builds

**Previous Session History (Nov 5, 2025):**
1. ✅ **App Store Connect created** - App ID: 6754896169
2. ✅ **First EAS build attempted** - Failed after 45+ minutes (timeout due to local build directories)
3. ✅ **Second EAS build completed** - 7 minutes, build ID: `bfa64e38-950f-486d-bb66-833a9dba2416` (Ad Hoc - installation failed)

**Critical Lessons Learned:**
- ❌ **MISTAKE:** Built with Ad Hoc without verifying device provisioning first
- ❌ **MISTAKE:** Did not discuss distribution strategy before building
- ❌ **MISTAKE (Nov 6):** Executed destructive git commands (`git rm -rf .`) without explanation or confirmation
- ❌ **MISTAKE (Nov 6):** Attempted GitHub Pages setup without asking user's preferred hosting approach
- ✅ **CORRECT APPROACH:** TestFlight for long-term, professional distribution
- ✅ **PHILOSOPHY:** "Accuracy over speed" - should have configured properly FIRST
- ✅ **PHILOSOPHY:** "Discussion over assumption" - MUST ask before acting

**Why TestFlight is the Right Choice:**
- No device UDID management required
- Works on any device added to TestFlight
- Professional distribution path (matches production workflow)
- Aligns with project philosophy: "Proper solutions, not workarounds"
- Future-proof: get new phone, just login to TestFlight

**Previous Issue (Nov 4, 2025) - RESOLVED:**
- Dev server auto-connection not working
- Root cause: Local builds didn't apply `NSLocalNetworkUsageDescription` permissions
- Solution: EAS Build with proper permissions in `app.json`

**Session Started:** November 5, 2025, 4:00 PM

---

## 📋 Testing & Issue Tracking

**All testing issues and progress tracked in:** [Momma B's Kitchen/TESTING.md](../Momma B's Kitchen/TESTING.md)

---

## 🚀 Next Steps (Priority Order)

**🔥 HIGHEST PRIORITY - Momma B's Pantry App (NEW):**

**Phase 1 - MVP (Build This Now):**
1. **Create Next.js App Structure**
   - Initialize Next.js 14 project at `/Users/macmini/Desktop/pantry-app`
   - Set up Tailwind CSS + shadcn/ui
   - Configure Supabase connection (same instance as scanner)
   - Set up environment variables

2. **Inventory List Page**
   - Query `inventory_items` filtered by household_id
   - Display items in list view with:
     - Product photo (from `photo_thumb`)
     - Product name + brand
     - Storage location
     - Expiration date
     - Package size
     - Nutri-Score badge

3. **Search Functionality**
   - Search bar at top
   - Filter by keywords (food_name, brand_name)
   - Real-time filtering as user types

4. **Storage Location Filters**
   - Quick filter buttons: All, Pantry, Fridge, Freezer, etc.
   - Use `storage_locations` table for dynamic filters

5. **Item Detail Page**
   - Large product photo
   - Full product information
   - Nutrition facts display
   - Health scores with visual badges
   - "Mark as Used" button

6. **Mark as Used Functionality**
   - Call Supabase RPC: `archive_inventory_item(item_id, current_date, 'consumed', null)`
   - Show success toast
   - Remove item from list (optimistic update)
   - Return to inventory list

7. **Deploy to Vercel**
   - Connect GitHub repo
   - Configure environment variables
   - Deploy and test on phone + computer

**Phase 2 - Enhanced Features (Later):**
8. Edit item details (quantity, expiration, location)
9. Partial consumption tracking (volume_remaining)
10. Expiring soon alerts (< 7 days badge)
11. Analytics dashboard preview

**Medium Priority - Scanner App Enhancements:**
12. **Package Size Confirmation UI**
   - Show: "We found: 15 oz - Is this correct? [Edit]"
   - Allow user to verify/correct before saving
   - Save corrections to product_catalog

13. **Health Score Badges in Review Screen**
   - Nutri-Score: Color-coded badge (A=green, E=red)
   - NOVA Group: Processing level indicator
   - Dietary icons: 🌱 vegan, 🥗 vegetarian

**Low Priority - Analytics (Future):**
14. **Health Dashboard**
   - Call `get_household_health_score()` RPC
   - Display: avg Nutri-Score, % vegan, % ultra-processed
   - Show trends over time

15. **Price Tracking UI**
   - Display current price on review screen
   - Show price history chart
   - Alert on price drops

---

## 🎯 Current State: SCALABLE PRODUCTION ARCHITECTURE

The scanner app has been **restructured with a scalable database design**:

1. ✅ **Mobile App** - React Native app with MB icon deployed to iPhone
2. ✅ **Edge Function** - `scanner-ingest` deployed with full Nutritionix data capture
3. ✅ **Database** - New `inventory_items` + `inventory_history` architecture
4. ✅ **Full Nutritionix Data** - Captures ALL available nutrition fields + metadata
5. ✅ **Future-Ready** - Price tracking, volume tracking, purchase location fields ready
6. ✅ **Storage Locations** - 8 locations in database with UUIDs
7. ✅ **API Integration** - Nutritionix API credentials configured server-side
8. ✅ **Error Handling** - QR code/invalid barcode detection with manual entry option
9. ✅ **Manual Date Entry** - Working date picker for expiration dates
10. ✅ **Review Screen** - Clean UI with all product data displaying correctly

---

## 🔑 Key System Components

## 🏠 Momma B's Household - Project Ecosystem

**Project Structure:**
```
/Users/macmini/Desktop/
├── scanner/              (Momma B's Scanner - React Native)
│   └── Ingests data into inventory_items table
└── pantry-app/           (Momma B's Pantry - Next.js)
    └── Reads & manages data from inventory_items table
```

**Key Architecture:**
- **Sibling Projects:** Two separate apps, equal hierarchy
- **Shared Backend:** Single Supabase instance, same tables
- **Clear Separation:** Scanner ingests, Pantry displays
- **Single Source of Truth:** `inventory_items` table

### Scanner App (React Native - Mobile Only)
- **Location:** `/Users/macmini/Desktop/scanner`
- **Platform:** React Native with Expo
- **Deployment:** Development build on iPhone (Device ID: 00008110-001645D13C47801E)
- **App Name:** "Momma B's Scanner"
- **App Icon:** Blue gradient with white "MB" letters
- **Metro Bundler:** Running on http://192.168.0.211:8081
- **Purpose:** Barcode scanning + camera OCR → Writes to `inventory_items`
- **Responsibility:** Data ingestion only

### Pantry App (Next.js - Phone + Computer) 🆕
- **Location:** `/Users/macmini/Desktop/pantry-app`
- **Platform:** Next.js 14 (App Router)
- **Deployment:** Vercel (accessible via browser on any device)
- **App Name:** "Momma B's Pantry"
- **Purpose:** View inventory, search items, mark as used → Reads from `inventory_items`
- **Responsibility:** Data display and management only
- **Status:** ✅ Initialized (Next.js + Supabase installed)

### Backend (Supabase - Shared by Both Apps)
- **Project ID:** bwglyyfcdjzvvjdxxjmk
- **Project URL:** https://bwglyyfcdjzvvjdxxjmk.supabase.co
- **Edge Function:** `scanner-ingest` (deployed)
- **Dashboard:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk

### Database Tables (NEW ARCHITECTURE - Oct 18, 2025)
1. **storage_locations** - 8 locations for household `7c093e13-4bcf-463e-96c1-9f499de9c4f2`
2. **inventory_items** - Active inventory with FULL Nutritionix data (40+ fields)
3. **inventory_history** - Archived consumed/used items for analytics
4. ~~**scans**~~ - REMOVED (replaced by inventory_items)
5. ~~**scan_history**~~ - REMOVED (replaced by inventory_history)

### OCR Library
- **Google ML Kit Text Recognition** - Industry-leading OCR for mobile
- **Note:** OCR struggles with embossed/stamped text on curved metal surfaces (this is expected)
- **Solution:** Manual date entry via date picker is working well

---

## 📱 How The Scanner Works

### Two-Step Workflow

**Step 1: Barcode Scan**
1. User taps "Start New Scan"
2. Camera scans barcode (UPC/EAN)
3. User selects storage location from picker (8 options)
4. App calls `scanner-ingest` edge function with:
   ```json
   {
     "workflow": "two-step",
     "step": 1,
     "barcode": "0039400018834",
     "storage_location_id": "05d891b0-66c1-48f0-adbc-a0d8288a0ca8"
   }
   ```
5. Edge function:
   - Calls Nutritionix API to lookup product
   - Creates record in `scans` table with status "pending_expiration"
   - Returns product data to app
6. **Error Handling:** If product not found (QR codes, non-UPC barcodes), user sees clear error with option for manual entry
7. App advances to Step 2

**Step 2: Expiration Date (OCR + Manual)**
1. Camera activates for OCR text recognition
2. ML Kit attempts to scan expiration date on product
3. If OCR fails (common with embossed text), user sees "No Date Found" dialog
4. User taps "Enter Manually" to use date picker
5. App calls `scanner-ingest` edge function with:
   ```json
   {
     "workflow": "two-step",
     "step": 2,
     "scan_id": "<uuid>",
     "ocr_text": "",
     "extracted_date": "2025-10-18",
     "confidence": 0,
     "processing_time_ms": 0
   }
   ```
6. Edge function updates scan record with expiration data and status "complete"
7. User reviews product data on EditableReview screen
8. **User sets volume remaining** (100%, 75%, 50%, 25%) - defaults to 100%
9. User taps "Approve with Edits" to finalize

---

## 🗂️ File Structure

```
scanner/
├── supabase/                      # Supabase configuration
│   ├── functions/
│   │   └── scanner-ingest/        # Edge function (DEPLOYED)
│   │       └── index.ts
│   ├── migrations/                # Database migrations
│   │   └── 20251018_create_scans_table.sql
│   └── config.toml
│
├── components/                    # React Native components
│   ├── BarcodeScanner.js          # Main scanner (uses database UUIDs, passes storageLocations)
│   ├── StorageLocationPicker.js   # Location picker (accepts database locations prop)
│   ├── EditableReview.js          # Review screen (includes volume remaining selector)
│   ├── ExpirationDateCapture.js   # OCR + manual date entry modal
│   └── VolumeSelector.js          # Volume remaining selector (100%, 75%, 50%, 25%)
│
├── services/                      # API layer
│   ├── scannerAPI.js              # Scanner API (FIXED: handles success:false from edge function)
│   ├── ocrService.js              # OCR wrapper with ML Kit
│   └── nutritionix.js             # Nutritionix integration
│
├── utils/
│   └── datePatternRecognition.js  # Date extraction patterns (simplified, no workarounds)
│
├── lib/
│   └── supabase.js                # Supabase client
│
├── .env                           # Environment variables
├── app.json                       # Expo config (has icon path)
└── README.md                      # Main documentation
```

---

## 🔐 Environment Variables

### Client-Side (.env)
**Note:** All credentials stored in 1Password. See `.env.example` for required variables.
```bash
EXPO_PUBLIC_SUPABASE_URL=<stored_in_1password>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<stored_in_1password>
EXPO_PUBLIC_NUTRITIONIX_APP_ID=<stored_in_1password>
EXPO_PUBLIC_NUTRITIONIX_API_KEY=<stored_in_1password>
```

### Server-Side (Supabase Secrets)
Set via: `supabase secrets set` (credentials stored in 1Password)
```bash
NUTRITIONIX_APP_ID=<stored_in_1password>
NUTRITIONIX_API_KEY=<stored_in_1password>
```

---

## 🏗️ Major Architecture Update (Oct 18, 2025, 3:40 PM)

### Database Restructure: Scalable Inventory System

**Motivation:**
- Previous `scans` table was temporary and limited
- Needed full Nutritionix data capture (40+ fields vs 13)
- Required future-ready fields for price tracking, volume management, purchase location
- Wanted analytics capability with historical data

**Changes Made:**

1. **New Tables:**
   - `inventory_items` - Active inventory with ALL Nutritionix fields
   - `inventory_history` - Archive for consumed items with analytics fields

2. **Removed Tables:**
   - Dropped `scans` table (replaced by inventory_items)
   - Dropped `scan_history` table (replaced by inventory_history)

3. **Edge Function Updates:**
   - Updated `scanner-ingest` to write to `inventory_items`
   - Now captures full Nutritionix response including:
     - All nutrition facts (nf_* fields)
     - Product metadata (nix_brand_id, nix_item_id)
     - Photos (thumb and highres URLs)
     - Full nutrients array (JSONB)
     - Alternative measures (JSONB)
     - Tags (JSONB)
   - Changed response from `scan_id` to `item_id`

4. **Mobile App Updates:**
   - Updated `scannerAPI.js` to use `item_id` instead of `scan_id`
   - Updated `BarcodeScanner.js` to reference inventory items
   - Added `archiveItem()` method for moving items to history

5. **Future-Ready Fields (Nullable for now):**
   - `purchase_date`, `price`, `location_purchased`
   - `volume_purchased`, `volume_unit`, `volume_remaining`
   - Status progression: pending → active → low → expired → consumed

6. **Helper Function:**
   - `archive_inventory_item(item_id, consumed_date, waste_reason, usage_notes)`
   - Automatically calculates days_in_inventory
   - Moves item from active to history table

**Benefits:**
- ✅ Complete nutrition data for future features
- ✅ Analytics-ready with historical tracking
- ✅ Price and volume tracking when ready
- ✅ Single source of truth per item lifecycle
- ✅ Fast queries on active inventory
- ✅ Waste reduction insights via history table

---

## 🛠️ Previous Fixes (Oct 18, 3:15 PM)

### 1. Product Not Found Error Handling
**Problem:** QR codes and invalid barcodes caused silent failures
**Solution:**
- Updated `scannerAPI.js` to check for `response.data.success === false`
- Updated `BarcodeScanner.js` to show user-friendly error dialog
- Added option to redirect to manual entry or retry scan

### 2. OCR Date Recognition Issues
**Problem:** OCR couldn't read embossed dates on curved metal (e.g., "BEST BY JUN 2027" read as "BEST BY UN2027")
**Analysis:** This is a computer vision limitation - ML Kit is optimized for flat printed text, not embossed metal
**Solution:**
- Removed ineffective OCR correction workarounds
- Kept OCR simple and reliable
- Manual date entry works perfectly as fallback
- Added detailed logging to help debug OCR issues

### 3. EditableReview Display Issues
**Problem:** Brand showed empty, storage location showed "undefined Pantry"
**Solution:**
- Fixed brand field to check both `productData.brand` and `productData.brand_name`
- Passed `storageLocations` prop from BarcodeScanner to EditableReview
- Removed icon display (database locations don't have icon field)
- Now shows just location name: "Pantry"

### 4. Category Field Removal
**Problem:** Category dropdown wasn't useful
**Solution:**
- Completely removed CategoryPicker component
- Removed category field from EditableReview form
- Cleaned up unused imports (FOOD_CATEGORIES, DEFAULT_STORAGE_BY_CATEGORY)
- Removed "Category doesn't match" from flag reasons

---

## 📊 Database Schema Reference (NEW ARCHITECTURE)

### inventory_items (Active Inventory)
```sql
-- Primary identifiers
id                     UUID PRIMARY KEY
created_at             TIMESTAMP WITH TIME ZONE
updated_at             TIMESTAMP WITH TIME ZONE
household_id           UUID NOT NULL

-- Barcode scan data
barcode                TEXT NOT NULL
scanned_at             TIMESTAMP WITH TIME ZONE

-- Basic product info from Nutritionix
food_name              TEXT
brand_name             TEXT
nix_brand_id           TEXT
nix_item_id            TEXT

-- Serving information
serving_qty            DECIMAL
serving_unit           TEXT
serving_weight_grams   DECIMAL

-- Core nutrition facts (per serving)
nf_calories            DECIMAL
nf_total_fat           DECIMAL
nf_saturated_fat       DECIMAL
nf_cholesterol         DECIMAL
nf_sodium              DECIMAL
nf_total_carbohydrate  DECIMAL
nf_dietary_fiber       DECIMAL
nf_sugars              DECIMAL
nf_protein             DECIMAL
nf_potassium           DECIMAL

-- Additional Nutritionix metadata
photo_thumb            TEXT
photo_highres          TEXT
ndb_no                 TEXT
source                 INTEGER
full_nutrients         JSONB  -- Complete nutrient breakdown
alt_measures           JSONB  -- Alternative serving sizes
tags                   JSONB  -- Product tags

-- Storage and expiration
storage_location_id    UUID REFERENCES storage_locations(id)
expiration_date        DATE

-- OCR data
ocr_text               TEXT
ocr_confidence         DECIMAL
ocr_processing_time_ms INTEGER

-- Future: Purchase tracking
purchase_date          DATE
price                  DECIMAL(10, 2)
location_purchased     TEXT

-- Future: Volume tracking
volume_purchased       DECIMAL
volume_unit            TEXT
volume_remaining       DECIMAL

-- Status tracking
status                 TEXT (pending, active, low, expired, consumed)
notes                  TEXT
```

### inventory_history (Consumed/Used Items for Analytics)
Same schema as `inventory_items` PLUS:
- `archived_at` - When item was moved to history
- `consumed_date` - When item was finished
- `days_in_inventory` - Purchase/scan → consumed duration
- `waste_reason` - consumed, expired, spoiled, discarded, other
- `usage_notes` - Additional context

### storage_locations
```sql
id                    UUID PRIMARY KEY
household_id          UUID
name                  TEXT
type                  TEXT (pantry, fridge, freezer, counter)
description           TEXT
temperature_controlled BOOLEAN
category_restrictions JSONB
created_at            TIMESTAMP
```

**Current Data:** 8 locations for household `7c093e13-4bcf-463e-96c1-9f499de9c4f2`
- Above Air Fryer
- Above Freezer
- Basket
- Dining Table
- Freezer
- Liquor Cabinet
- Pantry
- Refrigerator

---

## 🚀 Deployment Commands

### ⚠️ IMPORTANT: Build Process Philosophy

**NEVER use local iOS builds (`npx expo run:ios`).** This approach:
- Requires CocoaPods (brittle, slow, encoding issues)
- Violates project philosophy: "Stability over ease"
- Creates tech debt and maintenance burden
- Fails frequently on this Mac due to encoding issues

**ALWAYS use EAS Build for native changes.** This is the proper approach:
- Cloud-based builds (Expo handles CocoaPods complexity)
- Stable and reliable
- No local CocoaPods issues
- Follows project philosophy: "Completeness over convenience"

---

### Rebuild Mobile App (Native Code Changes Only)

**When you need a native rebuild:**
- Adding/updating native modules
- Changing Info.plist (permissions, config)
- Updating iOS entitlements

**PROPER METHOD - EAS Build for TestFlight (RECOMMENDED):**
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
eas build --platform ios --profile development
# Uploads to TestFlight automatically if configured
# Install via TestFlight app on iPhone
```

**Prerequisites for TestFlight Distribution:**
1. ✅ App Store Connect app record created (App ID: 6754896169)
2. ⏳ `eas.json` configured with `"distribution": "store"` (not "internal")
3. ⏳ App Store Connect metadata complete (REQUIRED BEFORE BUILD):
   - **Privacy policy URL** - Must be live URL or placeholder
   - **App description** - At least 1-2 sentences
   - **Age rating** - Select appropriate rating
   - **Category** - Primary category selection
4. ⏳ TestFlight app installed on target iPhone (download from App Store)
5. ⏳ Developer added as internal tester in App Store Connect:
   - Go to TestFlight tab → Internal Testing
   - Add Apple ID email as tester
6. ⏳ **Apple ID email confirmed** - What email receives TestFlight invites?

**CRITICAL: Answer these questions BEFORE building:**
- [ ] Privacy policy URL: Do you have one or need placeholder?
- [ ] Apple ID email: What email is your developer account under?
- [ ] TestFlight app: Already installed on iPhone? (Yes/No)
- [ ] App Store Connect description: Already filled in? (Yes/No)

**Why TestFlight over Ad Hoc:**
- No device UDID management
- Works on any device (get new phone = just login)
- Professional workflow (matches production)
- Follows project philosophy: proper, long-term solution

**DO NOT USE - Local Build (Deprecated):**
```bash
# ❌ NEVER RUN THIS - CocoaPods will fail
# npx expo run:ios --device "00008110-001645D13C47801E"
```

---

### Start Metro Bundler (JavaScript Changes - Day-to-Day Development)
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
npx expo start --dev-client
```
**Note:**
- Use this for ALL JavaScript-only changes (99% of development)
- App auto-connects to Metro at `http://192.168.0.211:8081`
- Instant hot reload
- No rebuild needed

---

### Deploy Edge Function
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
supabase functions deploy scanner-ingest
```

### Check Supabase Link
```bash
supabase link --project-ref bwglyyfcdjzvvjdxxjmk
```

---

## 🐛 Troubleshooting

### App Shows 404 Error
**Symptom:** Edge function returns 404
**Cause:** Function not deployed or deployment didn't complete
**Fix:** `supabase functions deploy scanner-ingest`

### Storage Locations Not Loading
**Symptom:** Empty array in console logs
**Cause:** RLS policy issue or wrong household_id
**Fix:** Verify RLS policy in Supabase Dashboard:
```sql
SELECT * FROM storage_locations WHERE household_id = '7c093e13-4bcf-463e-96c1-9f499de9c4f2';
```

### "Product Not Found" Error
**Symptom:** Alert shows "This barcode was not found in the nutritional database"
**Cause:** Barcode not in Nutritionix database (QR codes, non-UPC barcodes, or obscure products)
**Expected Behavior:** This is normal - not all codes are UPC/EAN product barcodes
**User Action:** User can choose "Manual Entry" or "Try Again"

### OCR Can't Read Expiration Date
**Symptom:** "No Date Found" dialog appears
**Cause:** Text is embossed/stamped on curved surface with poor contrast
**Expected Behavior:** This is a known limitation of OCR on embossed metal
**User Action:** User taps "Enter Manually" and uses date picker - works perfectly!

### Metro Bundler Won't Auto-Connect
**Symptom:** App shows "No development servers found" on launch
**Root Cause:** Missing iOS Local Network permissions in development build
**Status:** ⚠️ ACTIVE ISSUE - Requires EAS Build to fix properly

**Proper Fix:**
1. Verify `app.json` has Local Network permissions (already added):
   - `NSLocalNetworkUsageDescription`
   - `NSBonjourServices: ["_expodev._tcp"]`
2. Build with EAS: `npx eas build --platform ios --profile development`
3. Install new build - iOS will prompt for Local Network permission
4. Grant permission - app will now auto-discover Metro

**Temporary Workaround (until proper fix):**
1. Start Metro: `npx expo start --dev-client`
2. In app, tap "Enter URL manually"
3. Enter: `192.168.0.211:8081`

**Why This Happened:**
- Local builds with `npx expo run:ios` failed to apply permissions from `app.json`
- CocoaPods prebuild issues prevented proper Info.plist generation
- EAS Build handles this correctly in cloud environment

### Brand or Storage Location Shows Wrong
**Symptom:** Brand empty or storage showing "undefined"
**Status:** FIXED in this session
**If it happens again:** Check that EditableReview is receiving `storageLocations` prop

---

## 🔄 Current API Strategy (Nov 9, 2025)

### Scanner: Two-API Approach

**During Scanning (Fast Ingestion):**
1. **Product Catalog** - Check cache first (instant)
2. **Open Food Facts** - Nutrition, health scores, photos, dietary flags (UNLIMITED free)
3. **UPCitemdb** - Package sizes from titles, pricing data (100/day free)
4. **Manual Entry** - Fallback if APIs fail

**USDA Fuzzy Matching:**
- Scanner edge function captures USDA fuzzy matches (top 3) with confidence scores
- Stored in `usda_fuzzy_matches` JSONB field + `usda_match_validations` table
- User validates later in Pantry Desktop app (on-demand enrichment)
- Avoids slowing down physical scanning workflow
- See [Pantry HANDOFF.md](../momma-bs-pantry/HANDOFF.md) for validation workflow

### Multi-Source Data Storage

**Philosophy:** "Capture Everything, Show the Best"

```sql
-- Store each source separately
off_calories DECIMAL,      -- Open Food Facts
upc_calories DECIMAL,      -- UPCitemdb
usda_calories DECIMAL,     -- USDA (after Pantry validation)

-- Single source of truth (displayed)
nf_calories DECIMAL        -- Auto-selected: COALESCE(usda, off, upc)
```

**Benefits:**
- Know data provenance (which API provided what)
- Compare sources for quality control
- User can override with preferred source
- No data loss - all sources preserved
- Future-proof (easy to add new APIs)

### Package Size Detection

**Priority Order:**
1. **Product Catalog** - Previously verified sizes (fastest, most accurate)
2. **Open Food Facts** - `product_quantity` field
3. **UPCitemdb Title Parsing** - Regex: "15 oz", "425g", etc.
4. **Manual Entry** - User types size

**All sizes flow through catalog** for instant future lookups.

### Visual Identification for Items Without Barcodes (Planned)

**Purpose:** Scan produce, bulk items, and homemade foods using AI vision

**Workflow:**
1. User taps "Scan by Photo" (new button alongside barcode scan)
2. Take photo of item (e.g., apple, bulk nuts, homemade cookies)
3. **AI identifies product** using OpenAI GPT-4 Vision
   - Example: "Red apple, likely Fuji or Gala variety"
4. User sees editable suggestion: `[Fuji Apple]` with Edit button
5. User confirms or corrects identification
6. System searches USDA by confirmed name
7. Show top 3 USDA matches with photos (fuzzy matching)
8. User selects correct match
9. Proceed to expiration/location entry as normal

**Technical Implementation:**
- **AI Service:** OpenAI GPT-4 Vision API
- **Prompt:** "Identify this food item. Provide common name and variety if applicable. Be specific for produce (e.g., 'Fuji Apple' not just 'Apple')."
- **Photo Storage:** Upload to Supabase Storage, store URL in `photo_user_uploaded`
- **Barcode Generation:** `PHOTO-{timestamp}` for items without UPCs
- **USDA Integration:** Use existing fuzzy matching logic with AI-suggested name

**Benefits:**
- ✅ Scan produce without PLU stickers
- ✅ Track bulk bin purchases (nuts, grains, candy)
- ✅ Log homemade/leftover foods
- ✅ Handle international products without UPC
- ✅ Backup option when barcode won't scan

**Edge Cases:**
- AI can't identify → Falls back to manual text entry
- AI wrong → User corrects before USDA search
- No USDA match → Manual nutrition entry (future feature)
- Blurry photo → Prompt user to retake

**UI Location:** Main scan screen with two options:
```
┌─────────────────────────────┐
│   [Scan Barcode]            │  ← Existing
│   [Scan by Photo] 📷        │  ← New
└─────────────────────────────┘
```

---

## 📝 Next Steps / Future Improvements

### Short-Term (Current Status - Oct 18, 4:15 PM)
- ✅ All core features working
- ✅ Edge function deployed with full Nutritionix data
- ✅ **NEW:** Scalable database schema (inventory_items + inventory_history)
- ✅ **NEW:** 40+ nutrition fields captured from Nutritionix
- ✅ **NEW:** Triple API strategy decided (Nutritionix + UPCitemdb + Open Food Facts)
- ✅ **NEW:** Extended schema with 70+ new fields (package, pricing, health, environment)
- ✅ **NEW:** Migration created for all extended fields
- ✅ **NEW:** Analytics helper functions (health_score, price_trends)
- ✅ App icon visible
- ✅ Error handling for invalid barcodes
- ✅ Manual date entry working
- ✅ Review screen displaying all data correctly
- ✅ Category field removed

### Medium-Term Enhancements (UPDATED Oct 19, 2025)

**Refined Implementation Order (Based on External Review):**

1. **🔥 PHASE 3: Deploy Extended Schema (DO FIRST)**
   - Test migration locally with `supabase db reset`
   - Deploy to production with `supabase db push`
   - Verify backward compatibility with existing scans

2. **🔥 PHASE 4: Create product_catalog Table (DO SECOND)**
   - Build caching system to handle UPCitemdb 100/day rate limit
   - Cache lookup → API call → save to catalog workflow
   - User corrections update catalog for future scans

3. **🔥 PHASE 5: Triple API Integration (INCREMENTAL)**
   - Step 1: Add UPCitemdb to edge function (test with 10-20 products)
   - Step 2: Add Open Food Facts to edge function (same test products)
   - Step 3: Merge all three APIs + multi-layer package size detection
   - Step 4: Add package size confirmation UI

4. **🔥 PHASE 6: Analytics Helpers (VALIDATE DATA QUALITY)**
   - Build SQL functions: health_score, price_trends, waste_rate, expiring_soon
   - Test with real scanned data to validate API integration
   - Expose via Supabase RPC

5. **🔥 PHASE 7: Enhanced Review UI**
   - Package size confirmation with source badges
   - Health score displays (Nutri-Score, dietary tags)
   - Price display and user correction interface
   - **Volume remaining selector** (100%, 75%, 50%, 25%) - for scanning partial products

6. **Inventory View:** Show active inventory_items in the app
7. **Edit Items:** Allow editing/deleting inventory items
8. **Mark as Consumed:** Use `archive_inventory_item()` to move to history
9. **Price Tracking:** Add UI to capture price + location_purchased
10. **Volume Tracking:** Track volume_remaining, alert when low
11. **Household Selection:** Let users switch between households
12. **Offline Support:** Queue scans when offline, sync when back online

### Long-Term Features (Schema Ready!)
1. **Analytics Dashboard:**
   - Spending patterns from `inventory_history.price`
   - Waste tracking from `inventory_history.waste_reason`
   - Average days_in_inventory per product
   - Reorder predictions based on consumption rate
2. **Shopping List:**
   - Auto-generate from consumed items
   - Include price data from previous purchases
3. **Expiration Alerts:**
   - Notifications for items near expiration_date
   - Smart suggestions to use items before waste
4. **Admin UI:** Manage storage locations (add/edit/delete)
5. **Multi-household:** Support multiple households per user
6. **Barcode Database:** Build custom database for products not in Nutritionix

---

## 🤖 Working with Claude on This Project

### Critical Rules for AI Assistants

**BEFORE executing any command, you MUST:**
1. **Explain what the command does** in plain language
2. **Show the exact command** you plan to run
3. **Explain the potential risks** (especially for destructive operations)
4. **Wait for explicit user confirmation** before executing

**NEVER execute these commands without user approval:**
- `git rm` (deletes files from git)
- `git reset --hard` (destroys uncommitted changes)
- `git clean` (deletes untracked files)
- `git push --force` (rewrites remote history)
- `rm -rf` (deletes files permanently)
- `npm install` or `npm uninstall` (modifies dependencies)
- `eas build` (triggers expensive cloud builds)
- Any command that modifies `package.json`, `app.json`, `eas.json`

**Project Philosophy Enforcement:**
- ✅ **Accuracy over speed** - Never rush, always understand before acting
- ✅ **Discussion over assumption** - Ask questions, present options, wait for decisions
- ✅ **Completeness over convenience** - Proper solutions, not quick workarounds
- ✅ **Stability over ease** - Long-term maintainability over short-term convenience

**When User Says "Do X":**
1. **Don't immediately execute** - First discuss the approach
2. **Present options** with trade-offs
3. **Ask clarifying questions** if requirements are unclear
4. **Propose a plan** and get approval before starting
5. **Execute incrementally** - Show progress, don't batch everything

**Example: Good vs Bad Behavior**

❌ **BAD:**
```
User: "Set up GitHub Pages"
Claude: *immediately runs git commands without explanation*
```

✅ **GOOD:**
```
User: "Set up GitHub Pages"
Claude: "I can set up GitHub Pages in two ways:
Option A: Manual setup (30 seconds in browser)
Option B: Automated via gh-pages branch (requires git commands)

Which do you prefer? If Option B, I'll explain exactly what commands
I'll run before executing."
```

**Git Command Safety:**
- Always run `git status` before any git operation
- Never assume working directory is clean
- Show diff before committing
- Explain what each flag does (`-f`, `--hard`, `--force`, etc.)

**Deployment Safety:**
- EAS builds cost money and time - never trigger without confirmation
- Always show `eas.json` changes before building
- Confirm distribution type (development, preview, production)
- Verify build configuration before submitting

---

## 🔗 Important Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk
- **Supabase SQL Editor:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/sql
- **Edge Functions:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/functions
- **Nutritionix API Docs:** https://developer.nutritionix.com/
- **UPCitemdb API Docs:** https://devs.upcitemdb.com/
- **UPCitemdb API Explorer:** https://www.upcitemdb.com/api/explorer
- **Google ML Kit:** https://developers.google.com/ml-kit/vision/text-recognition

---

## 💡 What Claude Should Know Next Session

**Quick Start Prompt (UPDATED Oct 19, 2025 - 5:30 PM):**
> "Read HANDOFF.md. ✅ E2E TESTING COMPLETE! Scanner app working perfectly with triple API integration. ✅ PANTRY APP ARCHITECTURE DESIGNED - Ready to build Next.js web app for viewing/managing inventory. Next priority: Create Momma B's Pantry app (Phase 1 MVP - 7 steps outlined in 'Next Steps' section)."

**Key Context:**
1. ✅ **TWO APP STRATEGY DECIDED** - Scanner (React Native) + Pantry (Next.js web)
2. ✅ **SCANNER APP COMPLETE** - E2E tested, triple API working, all data saving correctly
3. ✅ **PANTRY APP DESIGNED** - Architecture complete, ready to build
4. ✅ **DATABASE READY** - inventory_items + inventory_history + archive function all operational
5. ✅ **TRIPLE API DEPLOYED** - Nutritionix + UPCitemdb + Open Food Facts (100+ fields per item)
6. ✅ **HEALTH SCORES CAPTURED** - Nutri-Score, NOVA, dietary flags, environmental data
7. ✅ **PACKAGE SIZE PARSING** - Working from UPCitemdb titles
8. ✅ **PRODUCT CATALOG CACHING** - Second scans instant, avoids rate limits
9. ✅ **PHOTOS AVAILABLE** - photo_thumb and photo_highres in database
10. ✅ **ARCHIVE FUNCTION READY** - `archive_inventory_item()` ready for "Mark as Used"

**Pantry App - Core Use Case:**
- User searches: "Do I have beans?"
- App shows: Bush's Black Beans with photo
- User sees: Location (Pantry), expiration, quantity
- User finds can using photo reference
- After using: Tap "Mark as Used"
- Backend: Archives to inventory_history

**Pantry App - MVP Features (Phase 1):**
1. Search inventory by keywords
2. View list with photos
3. Filter by storage location
4. Item detail page (photo, info, nutrition, health scores)
5. "Mark as Used" button (one tap archive)
6. Deploy to Vercel (accessible on phone + computer)

**Important Design Decisions:**
- **Momma B's Household Ecosystem** - Two sibling apps, one shared backend
  - **Scanner App:** Ingests data (barcode → API → database)
  - **Pantry App:** Displays data (database → search/view → archive)
  - **Equal Hierarchy:** Both are top-level projects, not nested
  - **Shared Backend:** Single Supabase instance, same `inventory_items` table
  - **Clear Separation:** Scanner writes, Pantry reads (single responsibility)
- **Platform Choices:**
  - Scanner: React Native (mobile-only, needs camera hardware)
  - Pantry: Next.js web (works on phone + computer, no hardware needed)
- **Start Simple, Build Scalable** - MVP has core features, architecture supports future enhancements
- **Photo-First Design** - Visual recognition key for finding items in crowded pantry
- **One-Tap Actions** - "Mark as Used" = one tap, no forms (MVP keeps it simple)
- **Triple API Strategy** - Maximum product intelligence from 3 free sources
  - Nutritionix (36 fields): Best nutrition data
  - UPCitemdb (18 fields): Package size, pricing, dimensions
  - Open Food Facts (227 fields!): Health scores, environment, dietary tags

**Pantry App Tech Stack:**
```
Platform:     Next.js 14 (App Router)
Database:     Supabase (same instance as scanner)
UI:           Tailwind CSS + shadcn/ui components
Auth:         Supabase Auth (household-based)
Search:       Supabase text queries
Deployment:   Vercel (free tier)
Location:     /Users/macmini/Desktop/pantry-app (to be created)
```

**Production Timeline (Oct 19, 2025 - 6:50 PM):**

**Phase 2: Internal Testing (Current - 2-4 Weeks)**
1. ✅ ~~E2E test scanner app~~ **DONE**
2. ✅ ~~Design pantry app architecture~~ **DONE**
3. ✅ ~~Create Pantry app MVP~~ **DONE**
4. 🔥 **DEPLOY PANTRY TO VERCEL** - Enable anywhere testing
5. 🔥 **SCAN 20 REAL ITEMS** - Build actual inventory
6. 🔥 **TEST FULL WORKFLOW** - Scan → Pantry → Mark as Used
7. 📝 **DOCUMENT ISSUES** - Track improvements needed from testing
8. 🔵 Add package size confirmation UI (based on testing feedback)
9. 🔵 Display health score badges in review screen
10. 🔵 Polish UX based on real-world usage

**Phase 3: Production Deploy (Week 3-4)**
11. 🚀 Submit Scanner to App Store (when 50+ scans complete and polished)
12. 🚀 Pantry in production on Vercel (already deployed during testing)

**Why Keep in Dev Mode:**
- Pantry usage will reveal needed Scanner improvements
- Package size confirmation UI needs real-world validation
- Easier to iterate before App Store submission
- Want 50+ successful scans before going live

**Common Requests:**
- "Build the pantry app" → Follow 7-step plan in "Next Steps" section
- "Test scanner" → Run `npx expo start`, scan barcode, verify data in database
- "Product not found" → Expected for QR codes and non-UPC barcodes
- "OCR not working" → This is expected for embossed text. Manual entry is the solution.
- "Log issues" → Document in [Momma B's Kitchen/TESTING.md](../Momma B's Kitchen/TESTING.md)

**Files Most Likely to Create Next:**
- `/Users/macmini/Desktop/pantry-app/` - New Next.js project directory
- `pantry-app/app/page.tsx` - Inventory list page
- `pantry-app/app/item/[id]/page.tsx` - Item detail page
- `pantry-app/lib/supabase.ts` - Supabase client configuration
- `pantry-app/.env.local` - Environment variables (same Supabase credentials)

**Database Helper Functions Available:**
- `archive_inventory_item(item_id, consumed_date, waste_reason, usage_notes)` - Move item to history
- `get_household_health_score(household_id)` - Get health metrics (future analytics)
- `get_price_trends(barcode, days)` - Get pricing data (future analytics)

---

---

## 📚 Analytics Helpers Explained

**What are Analytics Helpers?**
Analytics helpers are reusable functions that compute derived metrics from raw data for reporting, insights, or UI cues.

**Why Use Them?**
- Centralize business logic (don't duplicate calculations across app/dashboard/reports)
- Fast performance (SQL functions run in database, not client-side)
- Data validation (test that API integrations are capturing quality data)
- Enable real-time insights (health scores, waste rates, price trends, etc.)

**Where They Live:**
- **Preferred:** Database-level SQL functions in `supabase/migrations/*.sql`
- **Alternative:** JavaScript helpers in `services/` or `utils/` for client-side logic

**Examples Planned for This Project:**

```sql
-- Database functions (called via Supabase RPC from app)

CREATE FUNCTION get_household_health_score(household_uuid UUID)
RETURNS TABLE(
  avg_nutriscore TEXT,           -- "B+" average across pantry
  ultra_processed_pct DECIMAL,   -- % of items with NOVA group 4
  vegan_pct DECIMAL,             -- % vegan products
  vegetarian_pct DECIMAL         -- % vegetarian products
);

CREATE FUNCTION get_price_trends(product_barcode TEXT, days INTEGER)
RETURNS TABLE(
  current_price DECIMAL,
  lowest_price DECIMAL,
  highest_price DECIMAL,
  avg_price DECIMAL,
  price_direction TEXT           -- "up", "down", "stable"
);

CREATE FUNCTION get_waste_rate(household_uuid UUID, period_days INTEGER)
RETURNS TABLE(
  total_items INTEGER,
  consumed INTEGER,
  expired INTEGER,
  waste_pct DECIMAL              -- % expired vs consumed
);

CREATE FUNCTION get_expiring_soon(household_uuid UUID, days_threshold INTEGER)
RETURNS TABLE(
  item_id UUID,
  food_name TEXT,
  expiration_date DATE,
  days_until_expiry INTEGER,
  storage_location TEXT
);
```

**How They're Used:**
- Call from mobile app: `supabase.rpc('get_household_health_score', { household_uuid: '...' })`
- Power dashboard widgets (charts, badges, alerts)
- Drive notifications ("3 items expiring this week")
- Enable sorting/filtering ("Show least healthy items")
- Validate data quality after API integrations

---

## 🔜 What's Next (Priority Order)

### Immediate (Completed Nov 9, 2025)
1. ✅ **COMPLETED** - Fixed network connectivity issues (deprecated columns, RLS, ecoscore validation)
2. ✅ **COMPLETED** - Verified multi-source strategy working (OFF + UPC)
3. ✅ **COMPLETED** - Investigated USDA API issue
   - **Root Cause:** USDA branded database has limited UPC coverage (~0% match rate for tested products)
   - **Tested:** API is functional, returns data for name searches
   - **Example:** Bush's Black Beans in USDA with different UPCs (`00039400018803` not `0039400018834`)
   - **Data Value:** USDA provides Calcium, Iron, Potassium that OFF lacks
   - **Decision:** Implement fuzzy name-based matching with confidence scoring + user validation

### Short-Term (Next 1-2 Weeks)
4. **🔥 IN PROGRESS: Implement USDA fuzzy matching in scanner workflow**

   **Phase 1: Database Schema** ✅ COMPLETE (Nov 9, 2025)
   - ✅ Created `usda_match_validations` table
     - Tracks user acceptance/rejection of USDA fuzzy matches
     - Keys on `scanned_upc` + `usda_fdc_id` (not product name)
     - Stores validation status (TRUE = accepted, FALSE = rejected)
     - Enables confidence boosting (+20 pts if previously accepted)
     - Filters out rejected matches from future top 3 results
   - ✅ Added fields to `inventory_items` table
     - `usda_fuzzy_matches` JSONB - Array of top 3 matches with metadata
     - `usda_fuzzy_match_count` INTEGER - Quick count (0-3)
     - `requires_usda_validation` BOOLEAN - Flag for Desktop Pantry UI
   - ✅ Deployed migrations to Supabase

   **Phase 2: Edge Function Implementation** 🔜 NEXT (Current Task)
   - **Implementation Location:** After line 250 in `scanner-ingest/index.ts`
     - At this point we have `product.food_name` from OFF/UPC APIs
     - We have `barcode` that was scanned
     - USDA exact match already failed (line 140)
   - **Step 1:** Create `performUSDAFuzzySearch()` helper function
     - Input: `productName` (from OFF/UPC), `barcode`, `supabaseClient`
     - Call USDA API: `/foods/search?query={productName}&dataType=Branded&pageSize=50`
     - Returns: Array of all USDA results
   - **Step 2:** Create `calculateStringSimilarity()` helper function
     - Input: `str1`, `str2`
     - Algorithm: Levenshtein distance or Jaro-Winkler
     - Returns: Confidence score 0-100
   - **Step 3:** Create `filterAndRankUSDAMatches()` helper function
     - Input: `allMatches`, `scannedBarcode`, `scannedProductName`, `supabaseClient`
     - Query `usda_match_validations` table for existing validations
     - Calculate similarity scores for each USDA result
     - Filter out previously rejected matches
     - Boost confidence for previously accepted matches (+20 points)
     - Sort by confidence score
     - Return top 3 with metadata
   - **Step 4:** Update inventory item insert (line 310)
     - Add `usda_fuzzy_matches` field with top 3 results
     - Add `usda_fuzzy_match_count` field
     - Add `requires_usda_validation: true` if matches exist
     - Store complete nutrition data for each match

   **Phase 3: Desktop Pantry Validation UI** (Future)
   - Show top 3 matches side-by-side with scanned data
   - User accepts/rejects each match
   - Accepted matches marked "Previously validated" on future scans
   - Rejected matches never shown again for that scanned UPC

   **Goal:** Automation captures USDA data DURING scanning, user validates LATER, system learns and improves
5. **Continue internal testing** - Scan 20-50 household items
6. **Document data quality issues** in TESTING.md
7. **Review multi-source data display** in Pantry app (show provenance)

### Medium-Term (2-4 Weeks)
8. **Build Desktop Pantry validation UI**
   - Side-by-side comparison of fuzzy USDA matches
   - User validation: "Same product" or "Different product"
   - UPC alias creation on confirmation
   - Confidence score display
9. **Add package size confirmation UI** in Scanner
10. **Polish Scanner UI** based on testing feedback
11. **Add health score badges** in review screen
12. **Prepare for App Store submission** when 50+ scans complete

### USDA API Status (RESOLVED - Nov 9, 2025)
- **Issue:** Low exact barcode match rate (~0% for current products)
- **Root Cause:** USDA branded database UPC coverage gaps (different variants/sizes)
- **Impact:** Missing valuable micronutrient data (Calcium, Iron, Potassium)
- **Solution:** Fuzzy matching + user validation = capture more data safely

---

**End of Handoff Document**
**Status:** 🔥 IN PROGRESS - Phase 1 Complete (Database), Starting Phase 2 (Edge Function Implementation)
**Last Updated:** November 9, 2025, 6:00 PM
**Last Session:** Database schema complete and deployed. Documented detailed implementation plan for Phase 2: fuzzy USDA search, string similarity scoring, validation filtering, and top 3 match storage in edge function.
