# Momma B's Scanner - Handoff

**App:** React Native (iPhone)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning + AI vision
**Last Updated:** November 28, 2025 (Architecture Audit Verified)

---

## Current State

### Working ✅
- Authentication & RLS (secure login, household-based isolation)
- Barcode scanning (UPC/EAN via camera)
- PLU code entry (manual entry for produce stickers)
- AI Vision (OpenAI GPT-4o identifying produce)
- Multi-API integration (Open Food Facts + UPCitemdb + USDA)
- Photo uploads (Supabase Storage)
- Manual entry fallback
- OCR + manual date picker for expiration
- Edge function security (JWT auth, CORS restricted)

### Architecture Grade: **B** (Verified Nov 28, 2025)
**Strengths:** Feature-complete, secure, functional
**Weaknesses:** Monolithic component (1,294 lines), no observability, sequential API calls

### 🚨 **CRITICAL WARNING: DO NOT FIX BUGS IN BarcodeScanner.js**

**Problem:** 1,294 lines with 21 useState hooks = invisible state coupling
- **2^21 = 2,097,152 possible state combinations**
- Only a handful are valid
- Every change breaks something else (hidden dependencies)
- **This is not fixable by being more careful** - the architecture makes correctness impossible

**Solution:** Stabilize WITHOUT touching BarcodeScanner.js, then rewrite with XState

**Allowed Changes:**
- ✅ Database migrations (cleanup jobs)
- ✅ Edge function improvements (parallel APIs, idempotency)
- ✅ Wrapper components (error boundary around BarcodeScanner)
- ❌ Any changes to BarcodeScanner.js logic or state

---

## Verified Issues (Nov 28, 2025)

### 🔴 **P0 - Critical (Fix This Week)**

1. **Items Stuck in 'pending' Status** - `scanner-ingest:407`
   - **Problem:** Step 1 creates item with `status='pending'`, if Step 2 fails (network timeout, session expire), item stuck forever
   - **Verified:** Partial index exists (`idx_inventory_pending_created`), cleanup job missing
   - **Impact:** Database corruption, inventory count bloat
   - **Fix:** Add pg_cron job to cleanup items >24hrs old
   - **Effort:** Low (30 minutes)

2. **Orphaned Photo Storage** - `BarcodeScanner.js:192-270`
   - **Problem:** Photo uploads to Supabase Storage succeed, but if DB insert fails (invalid storage_location_id, RLS violation), file is orphaned forever
   - **Verified:** No cleanup mechanism exists
   - **Impact:** Storage bloat, costs grow unbounded
   - **Fix:** Database-first insert OR cleanup function
   - **Effort:** Medium (1-2 hours)

### 🟡 **P1 - High Priority (Next Week - EDGE FUNCTIONS ONLY, NOT BarcodeScanner.js)**

3. **Sequential API Calls** - `scanner-ingest:164-258`
   - **Problem:** UPCitemdb → OFF called sequentially, should use `Promise.allSettled()`
   - **Verified:** Lines 164-258, sequential fetch calls
   - **Impact:** +2-3 seconds per barcode scan
   - **Fix:** Parallelize API calls IN EDGE FUNCTION
   - **Effort:** Low (1 hour)
   - **Risk:** LOW (edge function only, no UI state changes)

4. **Hardcoded Household ID** - `BarcodeScanner.js:42` - ⚠️ **DEFERRED**
   - **Problem:** `const HOUSEHOLD_ID = '7c093e13-4bcf-463e-96c1-9f499de9c4f2';`
   - **Verified:** Line 42, hardcoded UUID
   - **Impact:** Blocks adding 2nd household
   - **Fix:** Use auth context for household_id
   - **Effort:** Low (30 minutes)
   - **Risk:** HIGH (requires touching BarcodeScanner.js state)
   - **Decision:** DEFER until after state machine rewrite

### 🟢 **P2 - Medium Priority (This Month)**

5. **No Idempotency Keys** - All edge functions
   - **Problem:** Network retries create duplicate inventory items; no deduplication protection
   - **Impact (Current Scale):** Low (rare with 2 users)
   - **Fix:** Add UUID-based idempotency key tracking
   - **Effort:** Medium (2-3 hours)

6. **AI Vision "No Matches" Problem** - `identify-by-photo:178-189`
   - **Problem:** `prepareUSDASearchTerm()` strips variety names (Fuji, Granny Smith) but USDA search still fails → item saved WITHOUT nutrition data
   - **Impact:** Users get "No Matches" even for valid produce
   - **Fix:** Try variety-specific search first, fall back to generic
   - **Effort:** Low (1 hour)

### 🔵 **P3-P5 - Defer (Code Quality, Not Blocking)**

7. **Monolithic Component** - `BarcodeScanner.js` (1,294 lines, 21 useState hooks)
   - **Verified:** Exactly 1,294 lines, 21 useState hooks found
   - **Impact:** Hard to debug, state consistency issues, unmaintainable
   - **Fix:** Refactor to XState or reducer-based state machine
   - **Effort:** High (1-2 weeks)
   - **Priority:** P4 (defer until stable)

8. **Missing TypeScript** - All components
   - **Impact:** Higher risk of runtime errors, harder to refactor
   - **Fix:** Gradual migration to TypeScript
   - **Effort:** High (2-3 weeks)
   - **Priority:** P4 (defer)

9. **PLU Database Incomplete** - `lookup-plu:10-28`
   - **Problem:** Hardcoded ~50 PLU codes, IFPS has 1000+
   - **Impact:** Missing PLU codes force manual entry
   - **Fix:** Import IFPS database into Supabase table
   - **Effort:** Medium (3-4 hours)
   - **Priority:** P5 (nice to have)

---

## Workflows

### 1. Barcode (Packaged Goods)
1. Scan barcode → select storage location
2. Edge function queries: Product Catalog (cache) → **UPCitemdb + OFF in parallel** (P1 fix needed)
3. OCR expiration date (or manual entry)
4. Review screen → save to database

### 2. PLU Code Entry (Produce Stickers)
1. "Enter PLU Code" → user enters 4-5 digit code from produce sticker
2. Edge function (`lookup-plu`) maps PLU to USDA search term (e.g., 4011 → "banana raw")
   - **Note:** Hardcoded mapping for ~50 common items only
   - **Limitation:** PLU codes are IFPS industry standards, not in USDA database
3. USDA FoodData Central returns nutrition matches
4. User selects match → storage location + expiration
5. Generates `PLU-{code}` barcode

### 3. AI Vision (Produce/Bulk)
1. "Scan by Photo" → camera captures image
2. OpenAI GPT-4 Vision identifies item
3. USDA + Open Food Facts searched **sequentially** (should be parallel)
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

## Verified Priority Roadmap (Nov 28, 2025)

### **Week 1: P0 Critical Fixes**
**Goal:** Prevent data corruption and storage bloat

| Priority | Issue | Effort | Files | Status |
|----------|-------|--------|-------|--------|
| P0 | Add cleanup job for stuck pending items | Low | New pg_cron migration | ❌ |
| P0 | Fix orphaned photo storage | Medium | BarcodeScanner.js:192-270 | ❌ |

### **Week 2: P1 High-Value Improvements**
**Goal:** Quick wins for UX and best practices

| Priority | Issue | Effort | Files | Status |
|----------|-------|--------|-------|--------|
| P1 | Parallelize API calls (UPC + OFF) | Low | scanner-ingest/index.ts:164-258 | ❌ |
| P1 | Remove hardcoded household ID | Low | BarcodeScanner.js:42 | ❌ |
| P1 | Add Sentry error tracking | Low | All components | ❌ |

### **Month 1-2: P2 Quality Improvements**
**Goal:** Improve data quality and prepare for scale

| Priority | Issue | Effort | Files |
|----------|-------|--------|-------|
| P2 | Add idempotency keys | Medium | scanner-ingest, identify-by-photo |
| P2 | Fix AI Vision variety names | Low | identify-by-photo:178-189 |
| P2 | Add request deduplication | Medium | Multiple locations |

### **Deferred: P3-P5 (High Effort, Low Urgency)**
- P4: Refactor BarcodeScanner to state machine (High effort)
- P4: Migrate components to TypeScript (High effort)
- P5: Import IFPS PLU database (Medium effort)
- P5: Add Vitest + React Testing Library (High effort)
- P5: Add Playwright E2E tests (High effort)

---

## Database Optimization

### ✅ Composite Indexes (Already Added Nov 27)
```sql
-- Verified as existing
CREATE INDEX idx_inventory_household_status ON inventory_items(household_id, status);
CREATE INDEX idx_inventory_household_location ON inventory_items(household_id, storage_location_id);
CREATE INDEX idx_inventory_household_barcode ON inventory_items(household_id, barcode);
CREATE INDEX idx_inventory_pending_created ON inventory_items(status, created_at) WHERE status = 'pending';
```

### ❌ Cleanup Job Needed (P0)
```sql
-- Add to pg_cron (missing)
SELECT cron.schedule(
  'cleanup-stuck-pending-items',
  '0 2 * * *',  -- Daily at 2am
  $$
    DELETE FROM inventory_items
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours'
  $$
);
```

### ❌ Photo Cleanup Function (P0 Alternative)
```sql
-- Option: Scheduled cleanup of orphaned photos
CREATE FUNCTION cleanup_orphaned_photos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete photos not referenced in inventory_items
  DELETE FROM storage.objects
  WHERE bucket_id = 'user-food-photos'
    AND name NOT IN (
      SELECT photo_thumb FROM inventory_items WHERE photo_thumb IS NOT NULL
      UNION
      SELECT photo_highres FROM inventory_items WHERE photo_highres IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup
SELECT cron.schedule(
  'cleanup-orphaned-photos',
  '0 3 * * *',  -- Daily at 3am
  'SELECT cleanup_orphaned_photos();'
);
```

---

## Code Quality Metrics (Verified)

**BarcodeScanner.js:**
- Lines: 1,294 (verified with `wc -l`)
- useState hooks: 21 (verified with `grep -c`)
- Complexity: Very High (multiple nested modals, state management)
- TypeScript: No
- Test Coverage: 0%

**Edge Functions:**
- Lines: ~500 each (scanner-ingest, identify-by-photo)
- TypeScript: Yes ✅
- Error handling: Partial (logs to database)
- Rate limiting: No
- Idempotency: No

---

## Next Actions (DO NOT TOUCH BarcodeScanner.js)

### **Week 1: Stabilize (P0 - Database & Wrapper Only)**
1. ❌ Add pg_cron job for stuck pending items (migration)
2. ❌ Add orphaned photo cleanup function (migration)
3. ❌ Wrap BarcodeScanner with ErrorBoundary (5-line wrapper)
4. ❌ Add reset button to error boundary

**Why?** Stop data loss WITHOUT touching fragile Scanner code

### **Week 2: Edge Function Improvements (P1 - NOT BarcodeScanner.js)**
1. ❌ Parallelize API calls in scanner-ingest edge function (Promise.allSettled)
2. ❌ Add Sentry error tracking (monitoring only)
3. ❌ Add idempotency keys to edge functions

**Why?** Performance wins without risking state coupling bugs

### **Week 3: Design State Machine (Planning, No Code)**
1. ❌ Map all Scanner states (idle, scanning, reviewing, etc.)
2. ❌ Map all events (SCAN, SELECT_LOCATION, CONFIRM, etc.)
3. ❌ Map valid transitions (state diagram)
4. ❌ Review design (Desktop Claude or peer review)

**Why?** Design when calm, not frustrated

### **Week 4-5: Rewrite Scanner (XState)**
1. ❌ Build XState machine with tests
2. ❌ Rebuild Scanner UI against machine (module by module)
3. ❌ Replace BarcodeScanner.js
4. ❌ Remove old code
5. ✅ THEN fix hardcoded household ID (safe after rewrite)

**Why?** Cannot safely fix 1,294-line monolith

---

**Handoff Status:** Complete and Verified
**Code Quality:** B (functional but needs refactor)
**Data Integrity:** C (pending items + orphaned photos need fixes)
**Performance:** B- (sequential APIs slow scans)
**Security:** A (RLS, JWT, service role correct)
**Last Audit:** November 28, 2025
**Next Review:** After P0/P1 fixes (December 15, 2025)
