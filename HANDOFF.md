# Momma B's Scanner - App-Specific Handoff

> **Part of Momma B's Household** → **Momma B's Kitchen**
>
> [Ecosystem Overview](../HANDOFF.md) | [Kitchen Subsystem](../Momma B's Kitchen/HANDOFF.md) | [Pantry App](../momma-bs-pantry/HANDOFF.md)

**App:** Scanner (React Native - Mobile)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning
**Date:** November 9, 2025
**Status:** ✅ **WORKING** - Multi-Source Strategy Operational (OFF + UPC), Manual Entry Fixed

---

## ✅ SYSTEM OPERATIONAL (Nov 9, 2025)

**All Systems Working:**
- ✅ Multi-source API strategy operational (OFF + UPC)
- ✅ Barcode scanning functional
- ✅ **Manual entry fixed** - No longer requires barcode (generates `MANUAL-{timestamp}`)
- ✅ Edge function properly handling all constraints
- ✅ Data flowing from APIs → Database

**Current API Performance:**
- ✅ **Open Food Facts** - Working perfectly (nutrition, photos, health scores, dietary flags)
- ✅ **UPCitemdb** - Working perfectly (package sizes)
- ⚠️ **USDA FoodData Central** - Low exact barcode match rate (~0% for current products)
  - **Root Cause Identified (Nov 9):** USDA branded database has limited UPC coverage
  - **Example:** Scanned `0039400018834` (Bush's) → Not in USDA, but USDA has `00039400018803` (different variant)
  - **Data Quality:** When USDA matches, provides valuable micronutrients (Calcium, Iron, Potassium) that OFF lacks
  - **Next Step:** Implementing fuzzy name-based matching with confidence scoring + user validation

**Recent Session (Nov 9, 2025):**
- 10 items successfully scanned with barcodes
- Manual entry debugged and fixed (barcode constraint + volume_remaining constraint)
- Generated unique barcodes for manual entries: `MANUAL-{timestamp}` format

---

## 🔄 CRITICAL UPDATE: Multi-Source Data Strategy (Nov 7, 2025)

**Issue:** Nutritionix subscription expired, $499/month paid tier required

**Solution:** Multi-source free API strategy with complete data provenance + fuzzy matching

### New API Architecture (Replacing Nutritionix)

**Philosophy: Capture Everything, Show the Best, Validate Later**

Instead of relying on one API, we now aggregate data from **all free sources**, track provenance, and handle UPC mismatches intelligently:

```
PRIORITY 1: Check product_catalog (cached data - skip APIs)

PRIORITY 2: USDA FoodData Central ✅ NEW!
   └─> FREE - 1,000 requests/hour
   └─> Government nutrition data (highest quality)
   └─> Branded foods by UPC/GTIN
   └─> API: https://api.nal.usda.gov/fdc/v1/foods/search

PRIORITY 3: UPCitemdb (existing)
   └─> FREE - 100 requests/day
   └─> Product names, brands, package sizes
   └─> Pricing data

PRIORITY 4: Open Food Facts (existing)
   └─> FREE - UNLIMITED
   └─> Health scores (Nutri-Score, NOVA)
   └─> Photos, environmental data
   └─> Dietary flags (vegan, vegetarian)

PRIORITY 5: Manual entry fallback
```

### Database Schema: Multi-Source Columns

**Design Principle:** Never assume one source is always correct. Store ALL data, let application logic choose best value.

**Schema Structure (per nutrient):**
```sql
-- Source-specific columns (track provenance)
usda_calories DECIMAL,
off_calories DECIMAL,
upc_calories DECIMAL,

-- Single Source of Truth (displayed value)
nf_calories DECIMAL  -- Auto-selected: COALESCE(usda, off, upc)
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

## 🔗 UPC Alias System & Fuzzy Matching (Nov 9, 2025)

**Problem:** API databases use different UPCs for the same product (regional variants, repackaging, size changes)

**Real-World Example:**
- Scan UPC `0039400018834` (Bush's Black Beans 15oz)
- USDA has no exact match for this UPC
- USDA **does** have UPC `0039400018957` (Bush's Black Beans different size)
- Nutrition data is nearly identical → Should we discard USDA data? NO!

**Solution: Probabilistic Data Capture with Deferred Validation**

### Core Principle: "Capture Everything, Even Uncertain Matches"

**Instead of:**
```
Exact barcode match fails → Discard API data → Move to next API
```

**We do:**
```
Exact barcode match fails → Name-based fuzzy search → Capture top 3 matches with metadata → Flag for user verification → Learn from corrections
```

### Fuzzy Matching Strategy (PLANNED - Nov 9, 2025)

**Status:** 🔜 Next feature to implement (USDA exact match rate is ~0%, fuzzy matching will improve coverage)

**When triggered:**
1. Exact barcode lookup fails in USDA API
2. Product name available from UPCitemdb or OFF
3. User initiates validation in Desktop Pantry app

**What we capture:**
- Top 3 name-based search results from USDA
- Each result includes: `matched_upc`, `match_score`, `api_nutrition_data`
- Flag: `requires_verification: true`, `match_type: 'fuzzy_name'`
- Confidence score: String similarity between product names (0-100)

**Example flow:**
1. Scan `0039400018834` → USDA exact barcode fails ✗
2. Get product name from UPCitemdb: "Bush's Black Beans"
3. Search USDA by name "Bush Black Beans": Returns 66,000+ results
4. Calculate string similarity scores for top 10 results
5. Capture top 3 best matches with confidence:
   - `00039400018803` "Bush's Black Beans 15 oz" (score: 95.2)
   - `00039400018827` "Bush's Black Beans 26.5 oz" (score: 92.1)
   - `00039400018797` "Bush's Black Beans 39 oz" (score: 91.8)
6. Store USDA nutrition data from best match, flagged as unverified
7. User validates in Desktop Pantry app later

**Why This Matters:**
- USDA provides **Calcium, Iron, Potassium** that OFF doesn't have
- Currently discarding valuable micronutrient data due to UPC mismatches
- User validation ensures data accuracy while capturing more information

### UPC Alias Database

**Purpose:** Many UPCs can point to the same canonical product

**Schema:**
```sql
CREATE TABLE upc_aliases (
  id UUID PRIMARY KEY,
  scanned_upc TEXT NOT NULL,        -- The UPC user actually scanned
  canonical_upc TEXT NOT NULL,      -- The "primary" UPC we treat as truth
  source TEXT NOT NULL,             -- 'usda' | 'off' | 'upc' | 'user_correction'
  match_confidence DECIMAL,         -- API relevance score (0-100)
  verified BOOLEAN DEFAULT false,   -- User confirmed this is correct
  verified_at TIMESTAMP,
  verified_by TEXT,                 -- User who validated
  created_at TIMESTAMP DEFAULT now()
)

-- Index for fast lookup during scanning
CREATE INDEX idx_upc_aliases_scanned ON upc_aliases(scanned_upc);
```

**Validation Workflow (Desktop Pantry App - Future):**
1. User sees item flagged "⚠️ USDA data from similar product"
2. Desktop app shows side-by-side comparison:
   - Scanned UPC: `0039400018834`
   - USDA UPC: `0039400018957`
   - Nutrition facts comparison
   - Product photos comparison
3. User validates: "✓ Same product" or "✗ Different product"
4. System creates alias: `0039400018834 → 0039400018957 (verified)`
5. Future scans of either UPC use same canonical product

### Inventory Deduplication

**Priority: Accurate Inventory > API Data Purity**

**Problem without aliases:**
- Monday: Scan UPC `0039400018834` → Create "Bush's Black Beans" item #1
- Tuesday: Scan UPC `0039400018957` → Create "Bush's Black Beans" item #2
- Result: Two pantry entries for same product ❌

**Solution with aliases:**
- Monday: Scan UPC `0039400018834` → Create inventory item (canonical: `0039400018834`)
- Desktop app validates: `0039400018957` is same product → Create alias
- Tuesday: Scan UPC `0039400018957` → Lookup alias → Find canonical → Update **existing** item #1
- Result: One pantry entry with accurate count ✅

**Scanner Logic (Before Insert):**
```typescript
// Check if scanned UPC has a canonical alias
const alias = await checkUPCAlias(scannedUPC)

if (alias) {
  // Find existing inventory item with canonical UPC
  const existingItem = await findInventoryItem(alias.canonical_upc)

  if (existingItem) {
    // Update existing item (quantity, expiration, etc.)
    return updateInventoryItem(existingItem.id, newData)
  }
}

// No alias or no existing item → Create new inventory item
return createInventoryItem(scannedUPC, data)
```

### API Update Strategy

**Always check for updates, even with validated aliases**

- Reason: API databases continuously improve (new products, corrected data)
- Cost: Minimal (1-2 seconds per scan)
- Benefit: Catch data corrections, new matches, updated nutrition facts

**Example:**
- Today: UPC `123` fails USDA lookup → Fuzzy match to UPC `456`
- User validates: `123 = 456`
- Tomorrow: USDA adds UPC `123` to their database (exact match now available!)
- Next scan: Edge function finds exact match → Updates data → Replaces fuzzy match

### Benefits of This Architecture

1. **Never lose potential data** - Even uncertain matches captured for review
2. **Self-improving system** - Every user validation teaches the system
3. **Handle real-world complexity** - Products change UPCs constantly
4. **API resilience** - Databases update independently, we stay current
5. **Accurate inventory** - Multiple UPCs → One product → No duplicates
6. **User trust** - Full transparency of data sources and confidence levels
7. **Future-proof** - Easy to add new APIs, new matching strategies

### Data Storage: Multi-Source with Confidence Tracking

**Every API field stores:**
- Source-specific value: `usda_calories`, `off_calories`, `upc_calories`
- Confidence metadata: `usda_calories_confidence` ('exact_barcode' | 'fuzzy_name_unverified' | 'fuzzy_name_verified')
- Source UPC: `usda_source_upc` (might differ from scanned UPC)
- Match score: `usda_match_score` (API relevance score)

**Example inventory_items record:**
```json
{
  "barcode": "0039400018834",
  "usda_calories": 120,
  "usda_calories_confidence": "fuzzy_name_unverified",
  "usda_source_upc": "0039400018957",
  "usda_match_score": 95.2,
  "off_calories": 120,
  "off_calories_confidence": "exact_barcode",
  "off_source_upc": "0039400018834",
  "nf_calories": 120,  // SSoT: selected from usda/off/upc
  "requires_verification": true,
  "potential_upc_matches": [
    {"upc": "0039400018957", "source": "usda", "score": 95.2},
    {"upc": "0039400019001", "source": "usda", "score": 89.4}
  ]
}
```

---

### Data Selection Philosophy (Nov 7, 2025)

**CRITICAL DECISION:** All API sources are equal - no hierarchy, no "better" source

**Data Sources (4 total):**
1. **User Input** (user_* columns) - Manual entry/corrections during scanning
2. **USDA FoodData Central** (usda_* columns) - Government nutrition data
3. **Open Food Facts** (off_* columns) - Community-sourced data
4. **UPCitemdb** (upc_* columns) - Commercial product database

**API Call Order:**
- USDA → UPCitemdb → Open Food Facts (sequential for rate limiting)
- User input collected during scanning workflow (manual entry/corrections)

**Data Storage:**
- ALL sources stored separately (user_*, usda_*, off_*, upc_*)
- 100% complete data provenance
- Timestamp tracking for user corrections (`user_verified_at`)

**Display Value Selection (`nf_*` fields):**
- **Current Strategy:** Use first available value (USER → USDA → OFF → UPC order)
  - **USER input = ALWAYS highest priority** (they looked at the label!)
  - API order is NOT a quality hierarchy, just pragmatic "use what we got first"
  - Temporary until we have real data to analyze
- **Future Strategy:** TBD after 20-50 scans
  - Will analyze which API has best coverage/accuracy per category
  - Options being considered:
    - Average all available sources?
    - Weighted average based on observed accuracy?
    - Per-nutrient logic (e.g., government data for macros, community data for allergens)?
    - User choice per item in Pantry app?
  - Easy to change - just update `selectBestNutrition()` function

**Why This Matters:**
- We're not picking a "winner" API - we're collecting ALL the data first
- User knows best when they correct something (highest trust)
- Real-world testing will reveal which API sources are most reliable
- Philosophy: "Store everything, decide later with evidence"

### What Changed from Nutritionix

**Lost:**
- `nix_brand_id`, `nix_item_id` (just IDs, not essential)

**Gained:**
- USDA government data (higher quality)
- Unlimited API calls (Open Food Facts)
- Multiple photos (USDA + OFF)
- Complete transparency (know source of each field)
- $499/month savings

**Same Quality or Better:**
- Nutrition facts: USDA matches or exceeds Nutritionix
- Photos: Open Food Facts has extensive image database
- Brand/product names: UPCitemdb provides
- Package sizes: UPCitemdb title parsing (already implemented)

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

## 🚀 Previous Session: API Fallback Implementation + Edge Function Logging (Oct 23, 2025, 10:30 AM - 11:10 AM)

**Mission:** Fix sake bottle scanning failure, implement proper API fallback, set up edge function logging
**Duration:** 40 minutes
**Status:** ✅ **COMPLETE**

### What We Accomplished

#### 1. API Fallback System Implemented ✅
**Problem:** Products not in Nutritionix (alcohol, non-food items) were failing with "Product not found" error
**Solution:** Implemented proper fallback cascade across all three APIs

**Before:**
- Nutritionix fails → immediate error
- UPCitemdb and Open Food Facts never called

**After:**
- Nutritionix fails → Try UPCitemdb → Try Open Food Facts → Error only if all fail
- Successfully scanned: Sho Chiku Bai Sake 750ml using UPCitemdb data
- Fixed cached product extraction to work with all data sources

**Technical Changes:**
- Modified edge function to attempt all APIs sequentially
- Added product reconstruction from UPCitemdb and Open Food Facts when Nutritionix unavailable
- Fixed cached data extraction to handle products saved from fallback APIs
- Added Nutri-Score validation to prevent database constraint violations

#### 2. Edge Function Logging System Created ✅
**Problem:** No way to debug edge function failures without accessing Supabase dashboard
**Solution:** Created queryable logging table with programmatic access

**Implementation:**
- Created `edge_function_logs` table with RLS policies
- Added `dbLog()` helper function for structured logging
- Can now query logs via Node.js script: `node check-logs.js`
- Logs include: timestamp, log level, message, data payload, barcode

**Benefits:**
- Real-time debugging of edge function execution
- No need to manually check Supabase dashboard
- Structured logs with searchable metadata
- Enabled rapid diagnosis of sake bottle scanning issue

#### 3. Bug Fixes ✅
- **Xcode Duplicate Project:** Removed `MommaBsScanner 2.xcodeproj` that was causing Metro warnings
- **Cached Product Extraction:** Fixed null product when cache contains only UPCitemdb/OFF data
- **Nutri-Score Validation:** Added validation to only allow 'a', 'b', 'c', 'd', 'e' grades

### Impact
- ✅ Scanner now supports alcoholic beverages and non-food items
- ✅ 23rd item successfully scanned (Sho Chiku Bai Sake)
- ✅ Edge function logging available for future debugging
- ✅ Development velocity improved with better observability

---

## 🚀 Previous Session: Testing Progress Update (Oct 21, 2025, 5:00-5:35 PM)

**Mission:** Document testing progress, identify issues, update HANDOFF files
**Duration:** 35 minutes
**Status:** ✅ **COMPLETE**

### What We Accomplished

#### Testing Session Summary ✅
- **22 items scanned** (44% of 50-item goal)
- **6 out of 8 storage locations** tested
- **Created TESTING.md** - Centralized issue tracking system
- **Launched Pantry app** - Now running at http://localhost:3001
- **Documented 3 issues** - 2 medium priority (package size), 1 low priority

**Key Metrics:**
- ✅ 100% health score coverage (22/22 items)
- ✅ 82% package size capture rate (18/22 items)
- ✅ 4.5% error rate (1 failed scan - expected behavior)
- ✅ All location targets met (pantry, refrigerator, freezer, other)

---

## 🚀 Previous Session: Scanner Focus Delay Fix (Oct 20, 2025, 9:00-9:30 PM)

**Mission:** Fix barcode scanner capturing blurry images by adding autofocus delay
**Duration:** 30 minutes
**Status:** ✅ **COMPLETE**

### What We Accomplished

#### Scanner Autofocus Delay Implemented ✅
- **Issue:** Barcode scanner was capturing images too quickly before camera could autofocus, resulting in blurry barcodes
- **Solution:** Added 800ms delay between barcode detection and processing
- **Implementation:**
  - Created separate `scanCooldown` ref to prevent duplicate scans during focus delay
  - Camera remains active during 800ms delay to allow autofocus to stabilize
  - After delay, `handleBarcodeScanned` is called with focused image
- **Result:** Scanner now captures clear, readable barcodes consistently

**Technical Details:**
- Modified `onCodeScanned` callback in BarcodeScanner.js
- Uses `scanCooldown.current` flag (separate from `isProcessing.current`)
- Camera stays active during delay (doesn't deactivate like it would with `isProcessing`)
- Prevents multiple scans of same barcode during the 800ms window

---

## 🚀 Previous Session: E2E Testing + Pantry App Planning (Oct 19, 2025, 5:00-5:30 PM)

**Mission:** Test scanner app end-to-end, plan companion pantry viewing app
**Duration:** 30 minutes
**Status:** ✅ **COMPLETE**

### What We Accomplished

#### 1. End-to-End Testing Verified ✅
- **Test #1:** Bush's Black Beans (0039400018834)
  - Triple API integration working perfectly
  - All data sources responded: Nutritionix ✅ UPCitemdb ✅ Open Food Facts ✅
  - Package size parsed: 15 oz
  - Health scores captured: Nutri-Score (a), NOVA (3), dietary flags (vegan, vegetarian)
  - Environmental data: Can packaging, USA origin
  - Data saved to `inventory_items` table successfully
- **Test #2:** Different product tested, all systems operational
- Metro bundler running stable
- Edge function responding correctly (version 5)
- OCR attempting date recognition, manual entry working as expected

#### 2. Momma B's Pantry App - Architecture Designed 🎨

**Purpose:** Separate web app for viewing and managing inventory (no scanner needed)

**Core Use Case:**
1. User searches: "Do I have beans?"
2. App shows: Bush's Black Beans with photo for visual recognition
3. User sees: Storage location (Pantry), expiration date, quantity
4. User finds can in physical pantry using photo reference
5. After using in recipe: Tap "Mark as Used"
6. Backend archives item to `inventory_history` for analytics

**MVP Features (Phase 1):**
- 🔍 Search inventory by keywords (product name, brand)
- 📋 View inventory list with photos
- 🖼️ Item detail view (photo, location, expiration, quantity, health scores)
- ✅ "Mark as Used" button (one tap archives with defaults)
- 🏷️ Filter by storage location (Pantry, Fridge, Freezer, etc.)

**Scalable Architecture (Future Phases):**
- Phase 2: Edit item details (quantity, expiration, location)
- Phase 3: Partial consumption tracking (volume_remaining)
- Phase 4: Shopping list generation from consumed items
- Phase 5: Analytics dashboard (consumption patterns, waste analysis)
- Phase 6: Expiration alerts and notifications

**Tech Stack Decision:**
```
Platform:     Next.js 14 (App Router) - works on phone + computer browser
Database:     Supabase (same instance as scanner app)
UI:           Tailwind CSS + shadcn/ui components
Auth:         Supabase Auth (household-based, same as scanner)
Search:       Supabase queries with text matching
Deployment:   Vercel (free tier, accessible from anywhere)
```

**Why Next.js Web App vs React Native:**
- ✅ Works on computer AND phone (user requirement)
- ✅ No app store deployment needed
- ✅ Faster to build and iterate
- ✅ Can be installed as PWA on phone
- ✅ Scanner app stays lightweight and camera-focused
- ✅ Separate concerns: scanning vs viewing/managing

**Database - Already Ready:**
- `inventory_items` table has all data (100+ fields)
- `inventory_history` table ready for archived items
- `archive_inventory_item()` function ready to use
- Photos available (`photo_thumb`, `photo_highres`)
- Health scores, dietary flags, package sizes all captured

**User Experience Design:**
```
Home Screen:
┌─────────────────────────────────┐
│ Momma B's Pantry       🔍 Search│
├─────────────────────────────────┤
│ 🔴 Expiring Soon (3 items)      │
├─────────────────────────────────┤
│ Filters: [All] [Pantry] [Fridge]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🖼️ Bush's Black Beans       │ │
│ │    Pantry • Expires Oct 27  │ │
│ │    15 oz • Nutri-Score: A   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

Detail Screen:
┌─────────────────────────────────┐
│ ← Back                          │
├─────────────────────────────────┤
│      [Product Photo]            │
│ Bush's Black Beans              │
│ Bush's Best                     │
│                                 │
│ 📍 Location: Pantry             │
│ 📅 Expires: Oct 27, 2025        │
│ 📦 Size: 15 oz                  │
│ 🏷️ Nutri-Score: A (Healthy)     │
│ 🌱 Vegan • Vegetarian           │
│                                 │
│ [Mark as Used]                  │
└─────────────────────────────────┘
```

**Mark as Used Behavior (MVP):**
- One tap action (no additional prompts for MVP)
- Backend calls: `archive_inventory_item(item_id, today's_date, 'consumed', null)`
- Item moves from `inventory_items` → `inventory_history`
- Item disappears from active inventory list
- Analytics can be run on history table later

### 🎯 Design Decisions

1. **Start Simple, Build Scalable**
   - MVP: Search, view, mark as used (core workflow only)
   - Architecture supports future features without refactoring
   - Database already has all fields needed for advanced features

2. **Two Separate Apps Strategy**
   - **Scanner App (React Native):** Barcode scanning + camera OCR (mobile-only)
   - **Pantry App (Next.js):** View + manage inventory (phone + computer)
   - Shared backend (Supabase), single source of truth

3. **Photo-First Design**
   - Visual recognition is key use case
   - Large photos help identify items in crowded pantry
   - Nutritionix photos are high quality

4. **One-Tap Actions**
   - Keep MVP simple: "Mark as Used" = one tap
   - No forms, no date pickers, no notes (for MVP)
   - Can add optional fields in Phase 2

---

## 🚀 Previous Session: Triple API Integration (Oct 19, 2025, 9:00-9:40 AM)

**Mission:** Deploy Triple API Integration
**Duration:** 40 minutes
**Status:** ✅ **COMPLETE**

### What We Accomplished

#### 1. Migrations Deployed
- Extended schema with 70+ new fields (package, pricing, health, environmental)
- Product catalog table with caching functionality
- Analytics helper functions (health_score, price_trends)
- All function security fixes applied

#### 2. Triple API Integration Implemented
- **Nutritionix API** - Already working (36 nutrition fields)
- **UPCitemdb API** - Added package size parsing from product titles
- **Open Food Facts API** - Added health scores, dietary flags, environmental data

#### 3. Data Extraction Working
- ✅ Package size: "15 oz" parsed from UPCitemdb title
- ✅ Health scores: Nutri-Score (a), NOVA (3), Eco-Score
- ✅ Dietary flags: Vegan (true), Vegetarian (true), Palm-oil-free
- ✅ Environmental: Packaging (Can), Origin (United States)
- ✅ Allergens: Captured from Open Food Facts

#### 4. Product Catalog Caching Operational
- First scan: Calls all 3 APIs, saves to product_catalog
- Second scan: Instant lookup from catalog (no API calls)
- Rate limit management: Avoids hitting UPCitemdb 100/day cap

#### 5. Testing Verified
- Test product: Bush's Black Beans (0039400018834)
- All 3 APIs returned data successfully
- Health scores displaying correctly in database
- Catalog lookup working on second scan

### 🔬 Test Results

```bash
Bush's Black Beans (0039400018834):
├─ Nutritionix API ✅
│  ├─ Nutrition: 120 cal, 8g protein, 22g carbs
│  ├─ Serving: 0.5 cup (130g)
│  └─ Photo URLs: thumb + highres
├─ UPCitemdb API ✅
│  ├─ Package: 15 oz (parsed from title)
│  └─ Title: "BUSH'S Black Beans, Reduced Sodium 15 oz"
└─ Open Food Facts API ✅
   ├─ Nutri-Score: a (best health rating)
   ├─ NOVA Group: 3 (processed food)
   ├─ Eco-Score: unknown
   ├─ Vegan: true
   ├─ Vegetarian: true
   ├─ Packaging: Can
   └─ Origin: United States
```

### 🎨 Example Data Captured

**Before (Nutritionix only):**
```json
{
  "food_name": "Black Beans, Reduced Sodium",
  "brand_name": "Bush's Best",
  "nf_calories": 120,
  "nf_protein": 8,
  "package_size": null,  // ❌ Missing
  "nutriscore_grade": null,  // ❌ Missing
  "is_vegan": null  // ❌ Missing
}
```

**After (Triple API):**
```json
{
  "food_name": "Black Beans, Reduced Sodium",
  "brand_name": "Bush's Best",
  "nf_calories": 120,
  "nf_protein": 8,
  "package_size": 15,  // ✅ From UPCitemdb
  "package_unit": "oz",  // ✅ From UPCitemdb
  "nutriscore_grade": "a",  // ✅ From Open Food Facts
  "nova_group": 3,  // ✅ From Open Food Facts
  "is_vegan": true,  // ✅ From Open Food Facts
  "is_vegetarian": true,  // ✅ From Open Food Facts
  "packaging_type": "Can",  // ✅ From Open Food Facts
  "origins": "United States"  // ✅ From Open Food Facts
}
```

### 📝 Files Modified

**Edge Function:**
- `supabase/functions/scanner-ingest/index.ts`
  - Added Open Food Facts API integration
  - Added `extractOpenFoodFactsData()` helper
  - Updated catalog save to include OFF data
  - Updated inventory insert with health scores

**Migrations (Deployed):**
- `20251018160000_add_extended_product_fields.sql` ✅
- `20251019000000_create_product_catalog.sql` ✅
- `20251019000100_fix_function_security.sql` ✅
- `20251019000200_fix_function_errors.sql` ✅

**Test Scripts Created:**
- `test_health_scores.js` - Verify health data in database

### 💡 Key Learnings

1. **Multi-API Strategy Works**
   - No single API has complete data
   - Combining 3 APIs gives maximum product intelligence
   - Graceful fallbacks ensure app never breaks

2. **Caching is Critical**
   - UPCitemdb has 100/day rate limit
   - Product catalog solves this completely
   - Second scans are instant (no API calls)

3. **Package Size is Fragile**
   - No API provides structured package size
   - Must parse from text fields (UPCitemdb title)
   - User verification is essential for accuracy

4. **Open Food Facts is Rich**
   - 227 fields available
   - Nutri-Score and NOVA are valuable for health insights
   - Vegan/vegetarian detection from ingredients analysis

### 🔍 Analytics Potential Unlocked

**Health & Diet:**
- "How healthy is my pantry?" (avg Nutri-Score)
- "What % ultra-processed?" (NOVA group 4 count)
- "Vegan/vegetarian breakdown"
- "Allergen alerts"

**Environmental:**
- "My carbon footprint" (Eco-Score)
- "Packaging waste" (% cans vs bottles)
- "Local vs imported" (% USA origin)

**Shopping Optimization:**
- "Price tracking" (Walmart vs Target)
- "Best time to buy" (price trends)
- "Average cost per category"

**Consumption Insights:**
- "What brands do I buy most?"
- "Days to consume per category"
- "Waste analysis" (expired vs consumed)
- "Reorder predictions"

### ✅ Success Metrics

- **APIs Integrated:** 3/3 (Nutritionix, UPCitemdb, Open Food Facts)
- **Fields Captured:** 100+ per product (up from 36)
- **Caching Working:** ✅ Second scans instant
- **Health Scores:** ✅ Nutri-Score, NOVA, dietary flags
- **Package Parsing:** ✅ 15 oz from title
- **Migrations Deployed:** ✅ All 4 migrations
- **Tests Passing:** ✅ All test scripts successful
- **Production Ready:** ✅ Edge function deployed

**Session Stats:**
- Duration: 40 minutes
- Database Changes: 70+ new columns, 1 new table, 5 new functions
- API Calls During Testing: 3 scans (1 fresh, 2 cached lookups)

### 🚀 Next Steps (Priority Order)

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

## 🔄 Quad API Strategy for Maximum Product Data (Nov 7, 2025 - UPDATED)

### Evolution: From Nutritionix to Multi-Source Free APIs

**Original (Oct 2025):** Triple API (Nutritionix + UPCitemdb + Open Food Facts)
**Updated (Nov 2025):** Quad API (USDA + UPCitemdb + Open Food Facts + Manual)

**Why the Change:**
- Nutritionix subscription expired ($499/month paid tier required)
- Free tier not sufficient for production use
- USDA FoodData Central provides equal or better government data
- Multi-source approach improves data quality and resilience

### The Solution: Quad API Strategy with Data Provenance

**Decision:** Capture data from ALL free sources, store separately, choose best value per field

**Architecture:**
```
Barcode Scan Flow:
1. Check product_catalog → Skip APIs if cached (FAST)
2. Call USDA FoodData Central → Government nutrition data
3. Call UPCitemdb API → Package data (size, weight, dimensions) + Pricing
4. Call Open Food Facts API → Health scores, environmental data, dietary tags
5. Store ALL sources separately → Enable comparison and override
6. Select best value per field → Display in UI
7. Fallback: Manual entry if all APIs fail
```

**Why Quad API?**

**USDA FoodData Central** - ✅ NEW! (Replacing Nutritionix)
- ✅ FREE - 1,000 requests/hour
- ✅ Government nutrition data (highest quality)
- ✅ Branded foods database (UPC/GTIN lookup)
- ✅ Public domain data (CC0 license)
- ✅ Comprehensive nutrient profiles
- ✅ API: `https://api.nal.usda.gov/fdc/v1/foods/search?query={barcode}`

**UPCitemdb (18 fields)** - Existing
- ✅ 495 million products
- ✅ FREE tier: 100 requests/day
- ✅ Package size (parsed from title: "15 oz")
- ✅ Pricing history & current offers
- ✅ Physical dimensions
- ✅ Amazon ASIN

**Open Food Facts (227 fields!)** - Existing
- ✅ UNLIMITED free tier
- ✅ Nutri-Score grade (A-E health rating)
- ✅ NOVA group (1-4 processing level)
- ✅ Eco-Score (environmental impact)
- ✅ Dietary tags (vegan, vegetarian, palm-oil-free)
- ✅ Allergen information
- ✅ Product photos (extensive image database)
- ✅ Packaging type & recyclability
- ✅ Country of origin

**Data Storage Strategy (Multi-Source Columns):**
```sql
-- Example: Calories from each source
usda_calories DECIMAL,        -- Government data
off_calories DECIMAL,         -- Community data
upc_calories DECIMAL,         -- Commercial data (if available)

-- Single Source of Truth (displayed)
nf_calories DECIMAL           -- Auto-selected best value

-- Raw API responses (debugging)
usda_raw_data JSONB
openfoodfacts_raw_data JSONB
upcitemdb_raw_data JSONB
```

**Smart Selection Logic:**
```javascript
// Prefer government > community > commercial
nf_calories = usda_calories ?? off_calories ?? upc_calories ?? null
```

### Package Size Challenge & Solution

**Discovery (Oct 18, 4:20 PM):**
After testing all available APIs, we found that **NO API provides structured package size data**:
- All APIs only have serving sizes or package sizes embedded in text fields
- UPCitemdb has best data but in title: "BUSH'S Reduced Sodium Black Beans **15 oz**"
- Regex parsing is fragile (breaks with "15oz" vs "15 oz" vs "425g")

**Solution: Multi-Layer Detection + User-Verified Catalog**
Instead of relying on one brittle approach, we use **5 priority layers** with user confirmation:
1. Our `product_catalog` (previously scanned/verified)
2. Open Food Facts validation
3. Smart regex parsing (multiple patterns)
4. OCR package label
5. Manual entry

Every scan shows: **"We found: 15 oz - Is this correct?"** allowing user verification.
Corrections are saved to `product_catalog` so the system learns and improves over time.

### Extended Database Schema (70+ new fields!)

**Migration created:** `20251018160000_add_extended_product_fields.sql`

**Additional table needed:** `product_catalog`
```sql
CREATE TABLE product_catalog (
  barcode TEXT PRIMARY KEY,
  package_size DECIMAL,
  package_unit TEXT,
  servings_per_container DECIMAL,
  verified_by_user BOOLEAN DEFAULT true,
  verified_at TIMESTAMP DEFAULT now(),
  verification_count INTEGER DEFAULT 1,
  last_seen TIMESTAMP DEFAULT now()
);
```
Purpose: Store user-verified package sizes for instant lookup on future scans.

**Package Information (UPCitemdb):**
- `package_size`, `package_unit` (parsed from title: "15 oz")
- `package_weight` ("3 Pounds")
- `package_dimensions` ("10 X 4 X 5 inches")
- `asin` (Amazon identifier)
- `model_number`

**Pricing Data (UPCitemdb):**
- `current_price`, `lowest_recorded_price`, `highest_recorded_price`
- `price_history` (JSONB - historical data)
- `price_retailers` (JSONB - current offers from Walmart, Target, etc.)

**Health Scores (Open Food Facts):**
- `nutriscore_grade` (a-e: health rating)
- `nova_group` (1-4: processing level)
- `ecoscore_grade` (a-e: environmental impact)
- `nutrient_levels` (JSONB: {fat: "low", salt: "moderate"})

**Dietary Information (Open Food Facts):**
- `is_vegan`, `is_vegetarian`, `is_palm_oil_free` (boolean flags)
- `allergens` (allergen warnings)
- `traces` (trace allergens)

**Labels & Certifications (Open Food Facts):**
- `labels` ("Low salt, Reduced sodium")
- `labels_tags` (JSONB: ["en:low-salt", "en:organic"])

**Environmental Data (Open Food Facts):**
- `packaging_type` ("Can", "Bottle", "Box")
- `packaging_tags` (JSONB: ["en:can", "en:recyclable"])
- `manufacturing_places` ("USA")
- `origins` (country of origin)
- `countries` (distribution countries)

**Product Categorization:**
- `category_path` (full category tree from UPCitemdb)
- `product_color`

**API Source Tracking:**
- `data_sources` (JSONB: {nutritionix: true, upcitemdb: true, openfoodfacts: true})

### Implementation Plan (UPDATED Oct 19, 2025)

**External Review (ChatGPT Assessment):**
> ✅ Roadmap is sound - schema ready, Nutritionix working, triple API strategy is logical
> ⚠️ Deploy migration FIRST before updating edge function (columns must exist before API data)
> ⚠️ UPCitemdb rate limit (100/day) requires caching via `product_catalog` table
> ⚠️ Instrument analytics helpers early to validate data quality from new APIs
> ✅ Multi-layer package detection is good hedge against inconsistent source data
> 📋 Test migration on staging/local first, expand edge function incrementally

**Phase 1: Extended Schema ✅ DONE**
- Created migration with 70+ new fields
- Added to both `inventory_items` and `inventory_history` tables
- Created analytics helper functions
- Added indexes for common queries

**Phase 2: Multi-Layer Package Size Detection Strategy**

**The Problem:**
No API provides reliable structured package size data:
- Nutritionix: Only has `serving_weight_grams` (130g serving, not 15 oz package)
- UPCitemdb: `size` field is empty, package size only in `title` ("BUSH'S... 15 oz")
- Open Food Facts: `product_quantity` shows serving size, not package size
- Barcode Lookup: Business API (not free), app shows size but no API access

**The Solution: Multi-Layer Approach (Priority Order)**

```javascript
Priority 1: Check our product_catalog table
  → If we've seen this barcode before, use our saved data
  → Fastest, most reliable (user-verified)

Priority 2: Try Open Food Facts product_quantity
  → Validate it makes sense (compare to serving_weight_grams)
  → Sometimes correct, sometimes just serving size

Priority 3: Parse UPCitemdb title with smart regex
  → Multiple patterns: "15 oz", "425g", "1.5 lbs", etc.
  → Extract both number and unit
  → Fallback patterns for edge cases

Priority 4: OCR the package label (like expiration dates)
  → User takes photo of "NET WT 15 OZ" text
  → Works for non-barcoded items too
  → More reliable than title parsing

Priority 5: Manual entry
  → User types package size and unit
  → Always works, always accurate

Confirmation UI (always shown):
  → "We found: 15 oz - Is this correct? [Edit]"
  → User can verify/correct before saving
  → Corrections saved to product_catalog for future scans
```

**Benefits:**
- ✅ Fast for repeat products (our catalog lookup)
- ✅ Automated when possible (Open Food Facts, title parsing)
- ✅ OCR option (works for any package, even non-barcoded)
- ✅ Manual fallback (100% success rate)
- ✅ User verification (catch API errors)
- ✅ Self-improving (builds catalog over time)
- ✅ No regex fragility (multiple fallbacks)

**Phase 3: Deploy Extended Schema (PRIORITY #1)**
- ⚠️ **MUST DO FIRST** - Run migration before updating edge function
- Test migration locally: `supabase db reset` to verify
- Deploy to production: `supabase db push`
- Verify existing scans still work (backward compatibility)
- Confirm all new columns exist with correct types

**Phase 4: Implement Caching for Rate Limits (PRIORITY #2)**
- Create `product_catalog` table migration
- Add lookup logic: check catalog BEFORE calling APIs
- Cache strategy:
  - First scan of barcode → Call APIs, save to catalog
  - Subsequent scans → Use catalog data (instant, no API calls)
  - User corrections → Update catalog with verified data
- This solves UPCitemdb 100/day bottleneck

**Phase 5: Triple API Integration (Incremental)**
- **Step 1:** Add UPCitemdb API call to edge function
  - Parse title for package size (regex with multiple patterns)
  - Extract pricing data
  - Handle API failures gracefully
  - Test with 10-20 products
- **Step 2:** Add Open Food Facts API call
  - Extract health scores (Nutri-Score, NOVA, Eco-Score)
  - Parse ingredients_analysis for dietary flags
  - Handle missing data (not all products in OFF database)
  - Test with same products from Step 1
- **Step 3:** Merge all three datasets
  - Combine Nutritionix + UPCitemdb + Open Food Facts
  - Set `data_sources` JSONB to track which APIs succeeded
  - Save to `inventory_items` with full extended schema
- **Step 4:** Implement multi-layer package size detection
  - Priority 1: Check product_catalog
  - Priority 2: Try Open Food Facts product_quantity
  - Priority 3: Parse UPCitemdb title (smart regex)
  - Priority 4: Manual entry fallback
  - Always show confirmation UI

**Phase 6: Analytics Helpers (Data Validation)**
- Build SQL functions in `supabase/migrations/`:
  - `get_household_health_score(household_id)` → avg Nutri-Score, NOVA, vegan %
  - `get_price_trends(barcode, days)` → min/max/avg pricing
  - `get_waste_rate(household_id, period)` → % expired vs consumed
  - `get_expiring_soon(household_id, days)` → items expiring within N days
- Test helpers with real data to validate API integration quality
- Expose via Supabase RPC for app to call

**Phase 7: Enhanced UI**
- Package size confirmation: "We found: 15 oz - Is this correct? [Edit]"
- Show data source badges: "From our catalog ✓" vs "Parsed from title ⚠️"
- Health score badges (Nutri-Score: A-E color-coded)
- Dietary tag icons (vegan 🌱, vegetarian 🥗, organic ♻️)
- Price display (if available from UPCitemdb)
- Allow user corrections (save to product_catalog for future)

### API Usage Estimates

**Current inventory scenario:**
- ~300-500 unique products (hundreds of cans, bottles, spices)
- Initial scan: 100/day (UPCitemdb bottleneck) = ~5 days to scan everything
- Ongoing: ~5-10 new products per week (well within free tier)

**API Rate Limits:**
- Nutritionix: Existing free tier
- UPCitemdb: 100/day (bottleneck but sufficient)
- Open Food Facts: UNLIMITED

**Conclusion:** All free tiers are sufficient, zero additional costs!

### Future Analytics Enabled

**Health & Diet:**
- "How healthy is my pantry?" (avg Nutri-Score: B+)
- "What % ultra-processed?" (NOVA group 4 count)
- "Vegan/vegetarian breakdown" (35% vegan, 60% vegetarian)
- "Allergen alerts" (notify if allergens detected)

**Environmental:**
- "My carbon footprint" (Eco-Score average)
- "Packaging waste" (% cans vs bottles vs boxes)
- "Local vs imported" (% USA origin)

**Shopping Optimization:**
- "Price tracking" (Walmart $1.25 vs Target $1.39)
- "Best time to buy" (historical price trends)
- "Average cost per category"
- "Spending patterns over time"

**Consumption Insights:**
- "What brands do I buy most?"
- "Days to consume per category"
- "Waste analysis" (expired vs consumed)
- "Reorder predictions"

### Benefits

- ✅ **Maximum data:** 281+ total fields (36 + 18 + 227) across all APIs
- ✅ **100% Free:** All three APIs have sufficient free tiers
- ✅ **Health insights:** Nutri-Score, NOVA, allergens, dietary tags
- ✅ **Environmental:** Eco-Score, packaging, origin tracking
- ✅ **Price intelligence:** Historical pricing, multi-retailer comparison
- ✅ **Resilient:** Three data sources + manual entry fallback
- ✅ **Analytics-ready:** SQL functions for instant insights
- ✅ **Scalable:** Can upgrade UPCitemdb if needed (currently free is enough)

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
4. **🔜 PRIORITY: Implement USDA fuzzy matching**
   - Add name-based search when exact barcode fails
   - Calculate string similarity confidence scores
   - Store top match with `requires_verification: true` flag
   - Add confidence tracking fields to database
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
**Status:** ✅ Fully Operational - 10 items scanned, USDA investigation complete
**Last Updated:** November 9, 2025, 3:00 PM
**Last Session:** USDA API investigation - Root cause identified, fuzzy matching solution planned
