# Momma B's Scanner - Handoff

**App:** React Native (iPhone)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning + AI vision

---

## Current State

### Working
- Authentication & RLS (secure login, household-based isolation)
- Barcode scanning (UPC/EAN via camera)
- PLU code entry (manual entry for produce stickers)
- AI Vision (OpenAI GPT-4o identifying produce)
- Multi-API integration (Open Food Facts + UPCitemdb + USDA)
- Photo uploads (Supabase Storage)
- Manual entry fallback
- OCR + manual date picker for expiration
- Edge function security (JWT auth, CORS restricted)

### Known Issues

#### 🔴 CRITICAL (Data Loss / Breaking Functionality)
1. **Orphaned Photo Storage** - `BarcodeScanner.js:192-270`
   - **Problem:** Photo uploads to Supabase Storage succeed, but if DB insert fails (invalid storage_location_id, RLS violation), file is orphaned forever
   - **Impact:** Storage bloat, potential data loss, no cleanup mechanism
   - **Fix:** Add transaction rollback or cleanup on DB insert failure

2. **No Idempotency Keys** - All edge functions
   - **Problem:** Network retries create duplicate inventory items; no deduplication protection
   - **Impact:** Users see duplicate items after network hiccups or double-clicks
   - **Fix:** Add UUID-based idempotency key tracking

3. **Items Stuck in 'pending' Status** - `scanner-ingest:407`
   - **Problem:** Step 1 creates item with `status='pending'`, if Step 2 fails (network timeout, session expire), item stuck forever
   - **Impact:** Database corruption, inventory count bloat
   - **Fix:** Add cron job to cleanup/expire stuck pending items (>24hrs old)

#### 🟡 HIGH (Performance / UX Degradation)
4. **AI Vision "No Matches" Problem** - `identify-by-photo:178-189`
   - **Problem:** `prepareUSDASearchTerm()` strips variety names (Fuji, Granny Smith) but USDA search still fails → user forced to manual entry → item saved WITHOUT nutrition data (`data_sources=null`)
   - **Impact:** Users get "No Matches" even for valid produce, data quality degraded
   - **Fix:** Try variety-specific search first, fall back to generic, prevent saving without nutrition

5. **Sequential API Calls** - `scanner-ingest:115-259`
   - **Problem:** UPCitemdb → OFF called sequentially, should use `Promise.all()`
   - **Impact:** +1-3 seconds per barcode on slow APIs
   - **Fix:** Parallelize API calls for barcode workflow

6. **Photo Upload Blocks DB Insert** - `BarcodeScanner.js:196-200`
   - **Problem:** Large photo uploads block entire workflow; serial execution
   - **Impact:** Slow UX, not graceful degradation on upload failures
   - **Fix:** Parallelize upload + DB insert, degrade gracefully on photo failure

#### 🟢 MEDIUM (Code Quality / Maintainability)
7. **PLU Database Incomplete** - `lookup-plu:10-28`
   - **Problem:** Hardcoded ~50 PLU codes, IFPS has 1000+, requires code deployment for new produce
   - **Impact:** Missing PLU codes force manual entry or AI Vision fallback
   - **Fix:** Import IFPS database into Supabase table or remove feature

8. **20+ useState in Monolithic Component** - `BarcodeScanner.js:18-37`
   - **Problem:** 1,294-line component with 20 separate state hooks, no centralized state machine
   - **Impact:** Hard to debug, state consistency issues, unmaintainable
   - **Fix:** Refactor to XState or reduce-based state machine

9. **Missing TypeScript in Frontend** - All components
   - **Problem:** No type safety for API responses, props, state
   - **Impact:** Higher risk of runtime errors, harder to refactor
   - **Fix:** Gradual migration to TypeScript

10. **Silent API Failures** - `identify-by-photo:416-422`
    - **Problem:** USDA/OFF failures return empty arrays without user notification
    - **Impact:** No error visibility, users confused by "No matches"
    - **Fix:** Surface error messages to user with retry options

11. **OCR Blocks Main Thread** - `ocrService.js:20`
    - **Problem:** ML Kit text recognition blocks UI for 1-2 seconds
    - **Impact:** UI frozen during OCR processing
    - **Fix:** Offload to web worker or background processing

12. **No Request Deduplication** - Multiple locations
    - **Problem:** Rapid duplicate scans/clicks make duplicate API calls
    - **Impact:** Unnecessary API usage, UPCitemdb rate limit exhaustion
    - **Fix:** Add request cache layer with short TTL

13. **Metro Auto-Connect** - Development friction
    - **Problem:** Requires manual URL entry (192.168.0.211:8081)
    - **Fix:** Rebuild with EAS or investigate Expo config

---

## Workflows

### 1. Barcode (Packaged Goods)
1. Scan barcode → select storage location
2. Edge function queries: Product Catalog (cache) → Open Food Facts → UPCitemdb
3. OCR expiration date (or manual entry)
4. Review screen → save to database

### 2. PLU Code Entry (Produce Stickers)
1. "Enter PLU Code" → user enters 4-5 digit code from produce sticker
2. Edge function (`lookup-plu`) maps PLU to USDA search term (e.g., 4011 → "banana raw")
   - **Note:** Hardcoded mapping for ~50 common items only. Not scalable long-term.
   - **Limitation:** PLU codes are IFPS industry standards, not in USDA database
3. USDA FoodData Central returns nutrition matches
4. User selects match → storage location + expiration
5. Generates `PLU-{code}` barcode

### 3. AI Vision (Produce/Bulk)
1. "Scan by Photo" → camera captures image
2. OpenAI GPT-4 Vision identifies item
3. USDA + Open Food Facts searched in parallel
4. User selects match → storage location + expiration
5. Generates `PHOTO-{timestamp}` barcode

### 4. Manual Entry
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
supabase functions deploy lookup-plu
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

**AI Vision Debug:**
- Check `edge_function_logs` table for `identify-by-photo` logs
- Items with missing nutrition: `SELECT * FROM inventory_items WHERE data_sources IS NULL AND barcode LIKE 'PHOTO-%'`
- Working photo scans have `usda_*` fields populated from USDA search results

---

## Prioritized Fix Roadmap

### Phase 1: Critical Bug Fixes (Week 1)
**Goal:** Fix data loss and breaking functionality

| Priority | Issue | Effort | File(s) |
|----------|-------|--------|---------|
| P0 | Fix orphaned photo storage | Medium | BarcodeScanner.js:192-270 |
| P0 | Add idempotency keys to edge functions | Medium | scanner-ingest, identify-by-photo |
| P0 | Add cleanup job for stuck pending items | Low | New migration + pg_cron |
| P1 | Fix AI Vision variety name preservation | Low | identify-by-photo:178-189 |

### Phase 2: Performance Optimization (Week 2)
**Goal:** Improve scan speed and UX

| Priority | Issue | Effort | Implementation |
|----------|-------|--------|----------------|
| P2 | Parallelize API calls (UPC + OFF) | Low | Promise.all() refactor |
| P2 | Parallelize photo upload + DB insert | Medium | Async refactor |
| P3 | Add request deduplication | Medium | Cache layer |
| P3 | Surface API error messages | Low | User-facing error alerts |

### Phase 3: Architecture & Code Quality (Week 3-4)
**Goal:** Improve maintainability and scalability

| Priority | Issue | Effort | Implementation |
|----------|-------|--------|----------------|
| P4 | Refactor BarcodeScanner to state machine | High | XState integration |
| P4 | Migrate components to TypeScript | High | Gradual migration |
| P5 | Import IFPS PLU database | Medium | New table + migration |
| P5 | Offload OCR to background | Medium | Worker thread |

### Phase 4: Testing & Monitoring (Ongoing)
| Task | Effort |
|------|--------|
| Add Vitest + React Testing Library | High |
| Add Playwright E2E tests | High |
| Implement Sentry error tracking | Low |
| Add performance monitoring | Low |

---

## Database Optimization Needs

### Missing Indexes (Add in migration)
```sql
-- Composite indexes for common queries
CREATE INDEX idx_inventory_household_status ON inventory_items(household_id, status);
CREATE INDEX idx_inventory_household_location ON inventory_items(household_id, storage_location_id);
CREATE INDEX idx_inventory_household_barcode ON inventory_items(household_id, barcode);

-- Pending item cleanup query optimization
CREATE INDEX idx_inventory_pending_created ON inventory_items(status, created_at) WHERE status = 'pending';
```

### Cleanup Job Needed
```sql
-- Delete items stuck in pending > 24 hours
DELETE FROM inventory_items
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';
```
