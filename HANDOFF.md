# Momma B's Scanner - App-Specific Handoff

> **Part of Momma B's Household** → **Momma B's Kitchen**
>
> [Ecosystem Overview](../HANDOFF.md) | [Kitchen Subsystem](../Momma B's Kitchen/HANDOFF.md) | [Pantry App](../momma-bs-pantry/HANDOFF.md)

**App:** Scanner (React Native - Mobile)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning + AI vision identification
**Status:** ✅ **OPERATIONAL** - Authentication, RLS, Barcode Scanning, and AI Vision working
**Last Updated:** November 17, 2025

---

## 🎯 CURRENT STATE

### What's Working
- ✅ **Authentication & RLS** - Secure login, household-based data isolation
- ✅ **Barcode Scanning** - UPC/EAN codes via camera
- ✅ **AI Vision** - OpenAI GPT-4o identifying produce (0.95 confidence on test)
- ✅ **Photo Uploads** - Supabase Storage bucket `user-food-photos`
- ✅ **Multi-API Integration** - Open Food Facts + UPCitemdb working
- ✅ **USDA for Produce** - Fresh produce nutrition (reintegrated Nov 16, previously shelved Nov 12)
- ✅ **Manual Entry** - Fallback for items without barcodes
- ✅ **OCR + Manual Date** - Expiration date capture with date picker fallback
- ✅ **Storage Locations** - 8 locations loaded from database

### Active Issues
- 🔜 **AI Vision UI incomplete** - Backend working, need product selection screen
- ⚠️ **Metro auto-connect** - Requires manual URL entry (needs EAS rebuild for permissions)

### Current User
- Email: werablr@gmail.com
- User ID: a4e98888-9537-442e-add6-e25815c01495
- Household: Momma Bs Test Household (7c093e13-4bcf-463e-96c1-9f499de9c4f2)

---

## 🏗️ SYSTEM ARCHITECTURE

### Project Ecosystem
```
/Users/macmini/Desktop/
├── momma-bs-scanner/     (React Native - THIS APP)
│   └── Ingests data via barcode/photo → inventory_items
└── momma-bs-pantry/      (Next.js web app)
    └── Displays/manages data from inventory_items
```

**Design Philosophy:**
- Sibling apps, equal hierarchy (not nested)
- Single Supabase backend, shared `inventory_items` table
- Scanner writes, Pantry reads (single responsibility)

### Scanner App
- **Platform:** React Native + Expo
- **Deployment:** Development build via EAS on iPhone (Device ID: 00008110-001645D13C47801E)
- **App Icon:** Blue gradient with "MB" letters
- **Metro:** http://192.168.0.211:8081
- **Repository:** https://github.com/werablr/momma-bs-scanner (public)

### Backend (Supabase)
- **Project ID:** bwglyyfcdjzvvjdxxjmk
- **URL:** https://bwglyyfcdjzvvjdxxjmk.supabase.co
- **Edge Functions:** `scanner-ingest`, `identify-by-photo`
- **Dashboard:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk

### Database Tables
1. **inventory_items** - Active inventory (40+ fields from APIs)
2. **inventory_history** - Consumed/archived items for analytics
3. **storage_locations** - 8 locations: Pantry, Fridge, Freezer, etc.
4. **households** + **user_households** - Multi-user auth/RLS

---

## 🔄 THREE-WORKFLOW SCANNER STRATEGY

### Workflow 1: Barcode Scanning (Packaged Goods)
1. Product Catalog (cache) → instant lookup
2. Open Food Facts → nutrition, health scores, photos, dietary flags (UNLIMITED free)
3. UPCitemdb → package sizes, pricing (100/day free)
4. Manual entry fallback

### Workflow 2: AI Vision (Produce/Bulk Items)
1. User taps "Scan by Photo" → camera captures image
2. Photo uploads to Supabase Storage
3. **OpenAI GPT-4 Vision** identifies item ("Bartlett Pear", 0.95 confidence)
4. **USDA + Open Food Facts** searched in parallel:
   - USDA: Fresh produce (🌱 badge) - "Pears, raw"
   - OFF: Packaged items (📦 badge) - "Bartlett pear halves, Del Monte"
5. User selects match → proceed to storage location + expiration
6. Generates `PHOTO-{timestamp}` barcode

**Why USDA for Produce:**
- Purpose-built for fresh/raw foods (not branded products)
- 150+ nutrients including micronutrients
- Auto-converts "Bartlett Pear" → "pear raw" for queries
- Filters: prioritizes raw/fresh, excludes canned/frozen/dried

**Status:** Backend complete, UI pending (product selection screen)

### Workflow 3: Manual Entry
- User types product name, brand, details
- Generates `MANUAL-{timestamp}` barcode

---

## 📊 DATABASE SCHEMA

### inventory_items (Active Inventory)
```sql
-- Core identifiers
id, household_id, barcode, scanned_at

-- Product info (multi-source)
food_name, brand_name, nix_brand_id, nix_item_id

-- Nutrition (40+ fields)
nf_calories, nf_total_fat, nf_protein, nf_sodium, etc.
off_calories, upc_calories, usda_calories  -- Source-specific
full_nutrients JSONB, alt_measures JSONB, tags JSONB

-- Photos
photo_thumb, photo_highres, photo_user_uploaded
ai_identified_name, ai_confidence

-- Storage & expiration
storage_location_id (UUID → storage_locations)
expiration_date, volume_remaining

-- Future-ready fields
purchase_date, price, location_purchased
status (pending, active, low, expired, consumed)
```

**Multi-Source Data Strategy:**
- Store each API separately: `off_calories`, `upc_calories`, `usda_calories`
- Single source of truth: `nf_calories` = `COALESCE(user, usda, off, upc)`
- Benefits: Data provenance, quality comparison, no data loss

### Helper Functions
```sql
archive_inventory_item(item_id, consumed_date, waste_reason, usage_notes)
  -- Moves item to inventory_history with days_in_inventory calculated

get_household_health_score(household_id)
  -- Future: avg Nutri-Score, % vegan, % ultra-processed

get_expiring_soon(household_id, days_threshold)
  -- Future: Items expiring within N days
```

---

## 📱 HOW IT WORKS

### Two-Step Barcode Workflow
**Step 1:** Scan barcode → select storage location → edge function queries APIs
**Step 2:** OCR expiration date (or manual entry) → review screen → save to database

### Review Screen
- Displays product data, nutrition facts, photo
- Volume remaining selector (100%, 75%, 50%, 25%)
- "Approve with Edits" saves to `inventory_items`

### Error Handling
- QR codes/invalid barcodes: Clear error with manual entry option
- OCR fails on embossed text: Expected behavior, manual date picker works perfectly
- Product not found: Expected for non-UPC codes

---

## 🗂️ FILE STRUCTURE

```
scanner/
├── supabase/
│   ├── functions/
│   │   ├── scanner-ingest/      # Barcode workflow
│   │   └── identify-by-photo/   # AI Vision
│   └── migrations/
├── components/
│   ├── BarcodeScanner.js        # Main scanner
│   ├── StorageLocationPicker.js
│   ├── EditableReview.js        # Review screen
│   ├── ExpirationDateCapture.js # OCR + manual date
│   └── VolumeSelector.js
├── services/
│   ├── scannerAPI.js            # Edge function calls
│   └── ocrService.js            # Google ML Kit wrapper
├── lib/supabase.js
├── .env                         # Secrets (gitignored)
└── app.json                     # Expo config
```

---

## 🔐 ENVIRONMENT & DEPLOYMENT

### Environment Variables
**Client (.env):** All stored in 1Password
```bash
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

**Server (Supabase Secrets):**
```bash
OPENAI_API_KEY, USDA_API_KEY
```

### Deployment Commands

**Daily Development (JavaScript changes):**
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
npx expo start --dev-client
```
Auto-connects to Metro, instant hot reload (99% of development)

**Native Rebuild (permissions, native modules):**
```bash
eas build --platform ios --profile development
```
⚠️ **NEVER use** `npx expo run:ios` - CocoaPods fails, violates "Stability over ease" philosophy

**Deploy Edge Function:**
```bash
supabase functions deploy scanner-ingest
supabase functions deploy identify-by-photo
```

### TestFlight Setup (Ready)
- ✅ App Store Connect configured (App ID: 6754896169)
- ✅ Privacy policy: https://werablr.github.io/momma-bs-scanner/PRIVACY_POLICY.md
- ✅ EAS config: `"distribution": "store"`
- ✅ Internal tester: werablr@gmail.com

---

## 🐛 ACTIVE TROUBLESHOOTING

### Metro Won't Auto-Connect
**Symptom:** App shows "No development servers found"
**Cause:** Missing iOS Local Network permissions in build
**Workaround:** Tap "Enter URL manually" → `192.168.0.211:8081`
**Fix:** Rebuild with EAS (permissions in `app.json` already added)

### Expected Behaviors (Not Bugs)
- **Product not found:** Normal for QR codes, non-UPC barcodes
- **OCR fails:** Expected for embossed/stamped text on curved surfaces
- **Manual entry needed:** By design for items without barcodes

---

## 🚀 NEXT STEPS (PRIORITY ORDER)

### Immediate (Current Session)
1. **🔥 Fix AI Vision Photo Upload Issue**
   - Current problem: Edge function cannot fetch from Supabase Storage (500 error)
   - OpenAI also cannot download from Supabase Storage URLs (invalid_image_url error)
   - Solution needed: Send base64 photo data directly from iPhone to edge function, bypassing Storage upload
   - Status: Unified workflow implemented (AI Vision creates DB record in step 1), but photo delivery to OpenAI broken

2. **Test pear scanning end-to-end** after photo delivery fix
3. **Document issues** in [Kitchen/TESTING.md](../Momma B's Kitchen/TESTING.md)

### Short-Term (1-2 Weeks)
4. **Package size confirmation UI** - "We found: 15 oz - Correct? [Edit]"
5. **Health score badges** - Nutri-Score, NOVA, dietary icons in review screen
6. **Deploy Pantry app to Vercel** - Enable full workflow testing

### Medium-Term (2-4 Weeks)
7. **Polish UX** based on real-world testing
8. **Optimize AI prompts** for better produce identification
9. **Prepare App Store submission** when 50+ scans complete

---

## 🤖 CRITICAL RULES FOR AI ASSISTANTS

### Project Philosophy
- ✅ **Accuracy over speed** - Understand before acting
- ✅ **Discussion over assumption** - Ask, present options, wait for approval
- ✅ **Completeness over convenience** - Proper solutions, not workarounds
- ✅ **Stability over ease** - Long-term maintainability

### NEVER Execute Without Approval
- `git rm`, `git reset --hard`, `git clean`, `git push --force`
- `rm -rf`, `npm install/uninstall`
- `eas build` (costs money/time)
- Modifications to `package.json`, `app.json`, `eas.json`

### Required Before Any Command
1. Explain what it does in plain language
2. Show exact command
3. Explain potential risks
4. Wait for explicit confirmation

### When User Says "Do X"
1. Don't immediately execute - discuss approach
2. Present options with trade-offs
3. Ask clarifying questions
4. Propose plan, get approval
5. Execute incrementally, show progress

---

## 💡 QUICK START FOR NEXT SESSION

**Context Summary:**
- Scanner app operational: barcode workflow ✅, AI Vision workflow ❌ (photo delivery issue)
- Unified two-step workflow implemented for both barcode and AI Vision items
- AI Vision creates DB record in step 1 (same as barcode), updates in step 2
- USDA reintegrated for fresh produce (searches USDA + OFF in parallel)
- Current blocker: Edge function/OpenAI cannot access Supabase Storage URLs
- Next action: Send base64 photo directly from iPhone to edge function

**Most Likely Next Tasks:**
1. Fix photo delivery: Send base64 from iPhone → edge function → OpenAI (bypass Storage)
2. Test pear scanning end-to-end
3. Verify pear data saves to inventory_items table
4. Build AI Vision product selection screen (if needed)

**Testing Checklist:**
- [ ] Scan barcode item end-to-end
- [ ] Scan produce via AI Vision (full workflow)
- [ ] Verify data in Supabase dashboard
- [ ] Test "Mark as Used" in Pantry app
- [ ] Document any issues in TESTING.md

---

## 🔗 IMPORTANT LINKS

- **Supabase Dashboard:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk
- **Supabase SQL Editor:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/sql
- **Edge Functions:** https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/functions
- **UPCitemdb API:** https://devs.upcitemdb.com/
- **Google ML Kit:** https://developers.google.com/ml-kit/vision/text-recognition

---

## 📝 RESOLVED ISSUES (REFERENCE ONLY)

**Database Migration (Oct 18):** Replaced `scans` table with `inventory_items` + `inventory_history` architecture
**Product Not Found Handling (Oct 18):** Added user-friendly error dialog with manual entry option
**OCR Issues (Oct 18):** Removed ineffective workarounds, manual date picker is reliable fallback
**Category Field (Oct 18):** Removed unused CategoryPicker component
**TestFlight Setup (Nov 6):** Security hardened, credentials moved to 1Password, repository public
**AI Vision Bug (Nov 14):** Fixed JSON parsing (OpenAI wraps response in markdown code fences)
**Photo Storage (Nov 14):** Fixed duplicate path in upload URLs

**Critical Lesson:** Built Ad Hoc without discussing strategy first - always use TestFlight for long-term distribution

---

**End of Handoff Document**
