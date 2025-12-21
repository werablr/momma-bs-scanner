# Momma B's Household - Handoff

**App:** React Native (iPhone)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Unified household app. Current module: Scanner (barcode + PLU + AI Vision)
**Last Updated:** December 21, 2025

---

## Roles

**At conversation start, ask: "Am I Desktop Claude or Code Claude?"**

### Brian (Human)
- Final approval authority
- Product owner
- Can override any Claude decision

### Desktop Claude (Supervisor)
- Controls optempo, provides guardrails
- Reviews work, makes go/no-go decisions
- Updates HANDOFF.md files
- Does NOT write code

### Code Claude (Executor)
- Writes code, runs tests
- Reports status, escalates blockers
- Does NOT make architectural decisions
- Finds gaps, catches bugs, guards philosophy
- Can pause and ask questions

---

## Dev Server Policy

**Dev servers are managed via DevDash** - `/Users/macmini/Desktop/DevDash/`

**Port:** 8082

**Code Claude Rules:**
- NEVER start dev servers autonomously
- NEVER use `run_in_background: true` for dev servers
- Ask Brian: "Please start the Scanner dev server via DevDash"
- Wait for confirmation before testing

---

## Architecture

**Stack:** React Native + Expo + XState v5 + Supabase

**Key Files:**
- `machines/scanner.machine.ts` - State machine (687 lines, 19 tests)
- `components/BarcodeScanner.tsx` - Main UI (XState-based)
- `supabase/functions/scanner-ingest/` - Barcode + Manual entry API edge function
- `supabase/functions/identify-by-photo/` - AI Vision edge function
- `supabase/functions/lookup-plu/` - PLU lookup edge function
- `contexts/AuthContext.tsx` - Authentication
- `theme/MommaBsHouseholdTheme.tsx` - Design system
- `SCANNER_UAT.md` - Comprehensive UAT checklist (300+ tests)

**Workflows:**
1. **Barcode** - Scan → Location → API lookup (OFF + UPC) → Expiration → Review → Save
2. **PLU** - Enter code → USDA lookup → Location → Expiration → Review → Save
3. **Photo** - Take photo → GPT-4o identifies PLU → USDA lookup → Save
4. **Manual** - Type product info → Location → API enrichment (OFF + USDA nutrition only) → Save

---

## Current State

### Working
- XState state machine (replaced 21 useState monolith)
- Barcode scanning (UPC/EAN)
- PLU code entry (1,545 codes with USDA nutrition)
- Photo workflow (AI Vision → PLU → USDA)
- Manual entry with API enrichment (OFF + USDA nutrition)
- Multi-API integration (OFF + UPCitemdb + USDA, parallelized)
- Idempotency keys (prevents duplicate items)
- Authentication & RLS
- Error boundary with crash recovery

### Open Issues

**P2 - This Month:**
- No real-time sync (User B must refresh to see User A's scans)
- No pagination (loads all items)

**P3+ - Deferred:**
- Full TypeScript migration
- Comprehensive UAT (300+ test cases in SCANNER_UAT.md)

---

## Commands

```bash
# Development (ask Brian to start via DevDash)
cd /Users/macmini/Desktop/momma-bs-scanner

# Native rebuild (permissions, native modules)
eas build --platform ios --profile development

# Deploy edge functions
supabase functions deploy scanner-ingest
supabase functions deploy identify-by-photo
supabase functions deploy lookup-plu
```

---

## Database

**Supabase Project:** bwglyyfcdjzvvjdxxjmk

**Key Tables:**
- `inventory_items` - Active inventory
- `inventory_history` - Archived items
- `storage_locations` - Household locations
- `plu_codes` - 1,545 PLU codes with USDA mappings
- `idempotency_keys` - Deduplication (24hr TTL)

**Key View:**
- `inventory_items_display` - COALESCE logic (USER > USDA > OFF > UPC)

**Scheduled Jobs (pg_cron):**
- 2am UTC: Cleanup stuck pending items (>24hrs)
- 3am UTC: Cleanup orphaned photos
- 4am UTC: Cleanup expired idempotency keys

---

## Manual Entry API Enrichment

**Feature:** Manual entries now fetch nutrition data from OpenFoodFacts and USDA FoodData Central

**Implementation:**
- Search query: `{brand_name} {product_name}` (brand optional)
- OFF: Text search via `/cgi/search.pl?search_terms=...`
- USDA: Text search via `/fdc/v1/foods/search?query=...`
- Parallel API calls for performance
- Top result used (APIs rank by relevance)

**Data Captured:**
- ✓ `usda_*` fields (15 nutrition fields + fdc_id + raw_data)
- ✓ `off_*` fields (10 nutrition fields)
- ✓ `data_sources` tracking

**Data NOT Captured (metadata excluded):**
- ✗ `serving_qty`, `serving_unit`, `serving_weight_grams`
- ✗ `photo_thumb`, `photo_highres`
- ✗ `package_size`, `package_unit`
- ✗ `nutriscore_grade`, `nova_group`, `ecoscore_grade`, `nutrient_levels`
- ✗ `is_vegan`, `is_vegetarian`, `is_palm_oil_free`, `allergens`, `traces`
- ✗ `labels`, `labels_tags`, `packaging_*`, `manufacturing_places`, `origins`, `countries`

**User Input Priority:**
- `food_name` = user input ONLY (never overridden)
- `brand_name` = user input ONLY (never auto-filled from API)

**Deployment:**
- Edge function: `scanner-ingest` (deployed Dec 21, 2025)
- Environment: `USDA_API_KEY` configured
