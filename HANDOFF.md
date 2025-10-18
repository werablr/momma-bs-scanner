# Scanner App - Session Handoff Document

**Date:** October 18, 2025, 3:40 PM
**Status:** ✅ Scalable Architecture - Production Ready
**Last Update:** Major database restructure with full Nutritionix data capture

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

### Mobile App
- **Location:** `/Users/macmini/Desktop/scanner`
- **Platform:** React Native with Expo
- **Deployment:** Development build on iPhone (Device ID: 00008110-001645D13C47801E)
- **App Name:** "Momma B's Scanner"
- **App Icon:** Blue gradient with white "MB" letters
- **Metro Bundler:** Running on http://192.168.0.211:8081

### Backend (Supabase)
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
8. User taps "Approve with Edits" to finalize

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
│   ├── EditableReview.js          # Review screen (FIXED: brand display, storage location display, category removed)
│   └── ExpirationDateCapture.js   # OCR + manual date entry modal
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
```bash
EXPO_PUBLIC_SUPABASE_URL=https://bwglyyfcdjzvvjdxxjmk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_NUTRITIONIX_APP_ID=f4d58212
EXPO_PUBLIC_NUTRITIONIX_API_KEY=c4aef73c1d82155043c4f3a6f2b9185a
```

### Server-Side (Supabase Secrets)
Set via: `supabase secrets set`
```bash
NUTRITIONIX_APP_ID=f4d58212
NUTRITIONIX_API_KEY=c4aef73c1d82155043c4f3a6f2b9185a
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

### Rebuild Mobile App (Full Native Rebuild)
```bash
cd /Users/macmini/Desktop/scanner
npx expo run:ios --device "00008110-001645D13C47801E"
```
**Note:** Only needed when changing native code (ML Kit, camera, etc.). Takes 2-3 minutes.

### Start Metro Bundler (JavaScript Hot Reload)
```bash
npx expo start
# Then connect app to: http://192.168.0.211:8081
```
**Note:** Use this for JavaScript-only changes. Instant reload.

### Deploy Edge Function
```bash
cd /Users/macmini/Desktop/scanner
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

### Metro Bundler Won't Connect
**Symptom:** App shows "No development servers found"
**Fix:**
1. Start Metro: `npx expo start`
2. In app, tap "Enter URL manually"
3. Enter: `192.168.0.211:8081`

### Brand or Storage Location Shows Wrong
**Symptom:** Brand empty or storage showing "undefined"
**Status:** FIXED in this session
**If it happens again:** Check that EditableReview is receiving `storageLocations` prop

---

## 🔄 Dual API Strategy for Complete Product Data (Oct 18, 2025, 4:00 PM)

### The Problem: Missing Package Size Data

**Issue Discovered:**
After successful scan test with Bush's Black Beans (15 oz can, 3 servings), we found critical data missing:
- ✅ Nutritionix provides: Nutrition facts, serving size (0.5 cup, 130g)
- ❌ Nutritionix does NOT provide: Package size (15 oz), servings per container (3)

**Why This Matters:**
- Hundreds of different package sizes in inventory (cans, bottles, spices, etc.)
- Need to track volume for usage alerts ("running low")
- Can't calculate total nutrients without knowing container size
- Important for shopping lists and reorder predictions

### The Solution: Dual API Strategy

**Decision:** Combine TWO data sources for complete product information

**Architecture:**
```
Barcode Scan Flow:
1. Call Nutritionix API → Nutrition facts (calories, fat, protein, etc.)
2. Call UPCitemdb API → Package data (size, weight, dimensions)
3. Merge both datasets → Complete product record
4. Fallback: Manual entry if either API fails
```

**Why UPCitemdb?**
- ✅ 495 million products in database
- ✅ FREE tier: 100 requests/day (sufficient for personal use)
- ✅ Returns: weight, size, dimensions, brand
- ✅ RESTful JSON API (easy integration)
- ✅ No signup required for free tier

**Data Completeness:**
- **Nutritionix:** nf_calories, nf_protein, nf_fat, serving_qty, serving_unit, serving_weight_grams
- **UPCitemdb:** package_size, package_unit, weight, dimensions
- **Manual/Calculated:** servings_per_container (can calculate: package_size ÷ serving_size)

### Implementation Plan

**Phase 1: Add Package Fields**
- Add to schema: `package_size`, `package_unit`, `servings_per_container`
- Add to both `inventory_items` and `inventory_history` tables

**Phase 2: Integrate UPCitemdb**
- Update `scanner-ingest` edge function to call UPCitemdb
- Merge UPCitemdb data with Nutritionix data
- Handle missing data gracefully (not all products in both DBs)

**Phase 3: Fallback Strategy**
- Create `product_catalog` table for user-entered data
- First scan: Manual entry if APIs don't have data
- Subsequent scans: Auto-populate from our catalog
- Over time, build personalized database of common products

**Phase 4: Manual Entry UI**
- Add package size fields to review screen (optional/editable)
- Show "We found this as 15 oz - is this correct?"
- Allow user corrections (save to product_catalog)

### API Usage Estimates

**Current inventory scenario:**
- ~300-500 unique products (hundreds of cans, bottles, spices)
- Initial scan: 100/day (free tier) = ~5 days to scan everything
- Ongoing: ~5-10 new products per week (well within free tier)

**Conclusion:** Free tier is sufficient, no additional costs needed!

### Benefits

- ✅ **Complete data:** Nutrition + package info = full product profile
- ✅ **Free:** Both APIs have sufficient free tiers
- ✅ **Scalable:** Can upgrade UPCitemdb if needed
- ✅ **Resilient:** Manual entry fallback for edge cases
- ✅ **Learning:** Builds custom product catalog over time
- ✅ **Analytics-ready:** Can calculate total nutrition per package

---

## 📝 Next Steps / Future Improvements

### Short-Term (Current Status - Oct 18, 4:00 PM)
- ✅ All core features working
- ✅ Edge function deployed with full Nutritionix data
- ✅ **NEW:** Scalable database schema (inventory_items + inventory_history)
- ✅ **NEW:** 40+ nutrition fields captured from Nutritionix
- ✅ **NEW:** Dual API strategy decided (Nutritionix + UPCitemdb)
- ✅ **NEW:** Future-ready fields for price/volume tracking
- ✅ App icon visible
- ✅ Error handling for invalid barcodes
- ✅ Manual date entry working
- ✅ Review screen displaying all data correctly
- ✅ Category field removed

### Medium-Term Enhancements (Next Steps!)
1. **🔥 PRIORITY: Implement UPCitemdb Integration**
   - Add package_size, package_unit, servings_per_container fields
   - Update edge function to call UPCitemdb API
   - Merge package data with nutrition data
   - Add manual entry fallback UI
2. **Inventory View:** Show active inventory_items in the app
3. **Edit Items:** Allow editing/deleting inventory items
4. **Mark as Consumed:** Use `archive_inventory_item()` to move to history
5. **Price Tracking:** Add UI to capture price + location_purchased
6. **Volume Tracking:** Track volume_remaining, alert when low
7. **Product Catalog:** Build reusable database of user-verified products
8. **Household Selection:** Let users switch between households
9. **Offline Support:** Queue scans when offline, sync when back online

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

**Quick Start Prompt:**
> "Read HANDOFF.md. Dual API strategy decided! Nutritionix (nutrition) + UPCitemdb (package size) = complete product data. Next priority: Implement UPCitemdb integration. What would you like to work on?"

**Key Context:**
1. ✅ **NEW DATABASE ARCHITECTURE** - inventory_items (active) + inventory_history (consumed)
2. ✅ **Full Nutritionix capture** - 40+ fields including nutrition, photos, metadata, JSONB nutrients
3. ✅ **DUAL API STRATEGY DECIDED** - Nutritionix + UPCitemdb for complete data
4. ❌ **MISSING DATA DISCOVERED** - Package size, servings per container NOT in Nutritionix
5. ✅ **Future-ready fields** - price, purchase_date, location_purchased, volume tracking
6. ✅ **Two-step workflow functional** - Barcode scan → expiration date → review → save to inventory_items
7. ✅ **Error handling works** - Invalid barcodes show friendly error with manual entry option
8. ✅ **OCR is acceptable** - We know it fails on embossed metal, manual entry is the solution
9. ✅ **Review screen is clean** - Brand, storage location display correctly. Category field removed.
10. ✅ **All UUIDs working** - Database locations passed as props throughout the app
11. ✅ **Test successful** - Bush's Black Beans scanned and saved to inventory_items table

**Important Design Decisions:**
- **Dual API Strategy** - Combine Nutritionix (nutrition) + UPCitemdb (package) for complete data
- **100 free requests/day** - UPCitemdb free tier sufficient for personal use (~5 days to scan entire pantry)
- **Scalable first** - Database designed for analytics, price tracking, volume management from day 1
- **Single source of truth** - inventory_items for active, inventory_history for consumed
- **Fallback to manual entry** - If APIs don't have data, user can enter package info (saved to product_catalog)
- **OCR limitations accepted** - Don't waste time on embossed text OCR. Manual entry works great.
- **Category removed** - User decided it wasn't useful
- **Manual entry is primary** - OCR is nice-to-have, manual entry is the reliable path

**Architecture Changes (Oct 18, 3:40-4:00 PM):**
- ❌ Removed: `scans`, `scan_history` tables
- ✅ Added: `inventory_items`, `inventory_history` tables
- ✅ Updated: Edge function to capture full Nutritionix response
- ✅ Updated: Mobile app to use `item_id` instead of `scan_id`
- ✅ Added: `archive_inventory_item()` helper function
- ✅ Decided: Dual API strategy (Nutritionix + UPCitemdb)
- 🔜 TODO: Add `package_size`, `package_unit`, `servings_per_container` fields
- 🔜 TODO: Implement UPCitemdb API integration in edge function
- 🔜 TODO: Create `product_catalog` table for user-verified data

**Common Requests:**
- "The app isn't working" → Check Metro bundler (`npx expo start`), check edge function logs
- "OCR not working" → This is expected for embossed text. Manual entry is the solution.
- "Need to add X feature" → Architecture is now scalable! See "Next Steps" for price tracking, volume management, analytics
- "Product not found" → Expected for QR codes and non-UPC barcodes
- "Need to test" → Run full scan workflow, data should save to inventory_items table

**Files Most Likely to Edit Next:**
- `components/BarcodeScanner.js` - Add inventory view, mark as consumed
- `supabase/functions/scanner-ingest/index.ts` - Backend logic for new features
- `services/scannerAPI.js` - Add methods for inventory queries
- New: Create inventory list view component
- New: Create analytics dashboard component

**Database Helper Functions Available:**
- `archive_inventory_item(item_id, consumed_date, waste_reason, usage_notes)` - Move item to history

---

**End of Handoff Document**
**Status:** ✅ Dual API Strategy Planned - Ready for UPCitemdb Integration
**Last Updated:** October 18, 2025, 4:00 PM
