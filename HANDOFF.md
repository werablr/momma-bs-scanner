# Momma B's Scanner - Handoff

**App:** React Native (iPhone)
**Location:** `/Users/macmini/Desktop/momma-bs-scanner/`
**Purpose:** Data ingestion via barcode scanning + AI vision
**Last Updated:** December 4, 2025 (Added Claude Roles)

---

## Roles

**At conversation start, ask: "Am I Desktop Claude or Code Claude?"**

### Brian (Human)
- **Final approval authority** - All decisions require Brian's sign-off
- **Product owner** - Defines requirements and priorities
- **Human in the loop** - Can override any Claude decision
- **Sets direction** - Decides what gets built and when

### Desktop Claude (Supervisor)
- **Controls optempo** - Sets pace, decides when to proceed
- **Provides guardrails** - Enforces philosophy, prevents deviation
- **Reviews work** - Validates Code Claude's output before approval
- **Makes go/no-go decisions** - Approves phase transitions
- **Updates documentation** - Maintains HANDOFF.md files
- **Does NOT write code** - Only reviews, directs, and documents
- **Reports to Brian** - Escalates decisions requiring human judgment

### Code Claude (Executor)
- **Writes code** - All implementation work
- **Runs tests** - Executes test plans, reports results
- **Follows instructions** - Executes tasks as directed by Desktop Claude
- **Reports status** - Provides detailed results after each action
- **Does NOT make architectural decisions** - Proposes, doesn't decide
- **Reports to Desktop Claude** - Escalates blockers and questions

**Code Claude is NOT a blind follower:**
- **Finds gaps** - Actively looks for missing requirements, edge cases, incomplete specs
- **Catches bugs** - Flags issues in existing code or proposed changes
- **Spots conflicts** - Identifies contradictions in requirements or design
- **Guards philosophy** - Calls out deviations from Core Tenets
- **Can pause production** - Has authority to stop and discuss if something feels wrong
- **Always asks questions** - Never proceeds with uncertainty; clarification is expected

---

## Dev Server Policy (Added December 4, 2025)

**NEVER use `run_in_background: true` for `npx expo start`**

**Rationale:** Background expo processes become orphaned, are uncontrollable, respawn indefinitely, and block ports permanently.

**Correct Workflow:**
1. Brian starts dev server via **Expo Orbit** (GUI app)
2. Server runs in dedicated terminal or Expo Orbit manages it
3. Code Claude queries server status if needed
4. Code Claude **NEVER** starts expo server autonomously

**If dev server is needed for testing:**
- Code Claude asks Brian: "Please start the dev server via Expo Orbit"
- Wait for confirmation before proceeding with tests

**Emergency Cleanup (if background processes are found):**
```bash
# Find launchd services
find ~/Library/LaunchAgents -name "*expo*" -o -name "*momma*"

# Unload service
launchctl unload <path-to-plist>

# Remove plist
rm <path-to-plist>

# Kill orphaned processes
pkill -f "expo start"

# Verify port 8081 is free
lsof -i :8081 || echo "Port 8081 is free"
```

---

## Current State - PHASE 3: Device Testing COMPLETE ✅

### ✅ PHASE 3 COMPLETE: Device Testing (Dec 3, 2025)

**Barcode Workflow (Device Tested):**
- ✅ 5 scans completed successfully on physical iPhone
- ✅ Error handling validated (transient network error recovered via retry)
- ✅ Multiple storage locations tested (Pantry, Freezer, Above Air Fryer, Above Freezer, Basket)
- ✅ All items saved with `status: active`
- ✅ State machine working correctly (scan → location → API → expiration → review → complete)
- ✅ No critical bugs or crashes

**Test Results (Dec 3, 2025):**
1. ✅ Hormel Hot Chili (barcode: 0037600233521) - Pantry
2. ✅ Libby's Vienna Sausage (barcode: 0039000086639) - Above Air Fryer (after retry)
3. ✅ GOYA Refried Beans (barcode: 0041331029018) - Above Freezer
4. ✅ Grandma's Original Molasses (barcode: 0072400711244) - Basket
5. ✅ Crisco Vegetable Oil (barcode: 0196005708338) - Freezer

**PLU Workflow (Implementation Complete, Device Testing Pending):**
- ✅ State machine integration (`machines/scanner.machine.ts`)
  - `lookupPLU` actor → calls `lookup-plu` edge function
  - `createPLUItem` actor → creates inventory item directly (no Step 1/Step 2)
  - Auto-select single match, selection UI for multiple matches
- ✅ PLU entry UI (`BarcodeScannerV2.tsx`)
  - PLU input screen with 4-5 digit validation
  - Match selection screen for multiple USDA results
- ✅ `lookup-plu` edge function deployed (queries plu_codes table)
- ⏳ Device testing: Pending (5 scans required)

**PLU Database (COMPLETE):**
- ✅ **1,545 PLU codes** imported to Supabase `plu_codes` table
- ✅ **ALL 20 IFPS columns** captured per "capture everything" philosophy
- ✅ **1,235 PLU codes (79%)** have USDA nutrition mappings
- ✅ **310 PLU codes (21%)** without USDA data (valid - not in SR Legacy)
- ✅ Handles duplicate PLU codes (same code, different size/restrictions)
- ✅ Edge function returns all variants for selection
- ✅ RFC 4180 CSV parsing (handles multi-line quoted fields)

### ✅ PHASE 2 COMPLETE: XState State Machine (Nov 29, 2025)

**New Scanner (BarcodeScannerV2):**
- ✅ Zero useState for workflow state (replaced 21 hooks with single state machine)
- ✅ XState v5 with 19/19 passing tests
- ✅ Real Supabase API integration (Step 1, Step 2, finalization)
- ✅ End-to-end tested on device (barcode workflow)
- ✅ Error handling (retry/cancel with cleanup)
- ✅ Crash recovery (interrupted state with resume/discard)
- ✅ Feature flag for safe rollout (`USE_STATE_MACHINE = __DEV__`)
- ✅ Comprehensive logging for debugging

**Legacy Scanner (BarcodeScanner.js):**
- Still available when `USE_STATE_MACHINE = false`
- Will be removed after device testing confirms V2 stability

### Working ✅
- Authentication & RLS (secure login, household-based isolation)
- Barcode scanning (UPC/EAN via camera)
- PLU code entry (manual entry for produce stickers)
- AI Vision (OpenAI GPT-4o identifying produce)
- Multi-API integration (Open Food Facts + UPCitemdb + USDA - **parallelized**)
- Photo uploads (Supabase Storage)
- Manual entry fallback
- OCR + manual date picker for expiration
- Edge function security (JWT auth, CORS restricted)

### Architecture Grade: **A-** (Upgraded Nov 29, 2025)
**Strengths:** State machine architecture, testable, type-safe, feature-complete
**Weaknesses:** Success screen placeholder, secondary workflows deferred to Phase 3

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

### ✅ **P0 - Critical (Fixed Nov 28, 2025)**

1. **Items Stuck in 'pending' Status** - ✅ FIXED
   - **Problem:** Step 1 creates item with `status='pending'`, if Step 2 fails (network timeout, session expire), item stuck forever
   - **Solution:** Migration `20251128000000_add_pending_cleanup_job.sql`
   - **Result:** pg_cron job runs daily at 2am UTC, deletes items >24hrs old
   - **Impact:** Database corruption prevented

2. **Orphaned Photo Storage** - ✅ FIXED
   - **Problem:** Photo uploads to Supabase Storage succeed, but if DB insert fails (invalid storage_location_id, RLS violation), file is orphaned forever
   - **Solution:** Migration `20251128000001_add_orphaned_photo_cleanup.sql`
   - **Result:** cleanup_orphaned_photos() function runs daily at 3am UTC
   - **Impact:** Storage costs controlled

3. **Scanner Crash Recovery** - ✅ FIXED
   - **Problem:** Component crashes leave users stuck with no recovery
   - **Solution:** ScannerErrorBoundary.tsx wrapper component
   - **Result:** Error boundary catches crashes, reset button allows recovery
   - **Files:** components/ScannerErrorBoundary.tsx, app/(tabs)/index.tsx
   - **Impact:** Users can recover from errors without app restart

### ✅ **P1 - High Priority (Fixed Nov 28, 2025)**

3. **Sequential API Calls** - ✅ FIXED
   - **Problem:** UPCitemdb → OFF called sequentially, wasting 2-3 seconds per scan
   - **Solution:** Refactored to use Promise.allSettled for parallel API calls
   - **Result:** Both APIs called simultaneously, wait for fastest response
   - **Files:** supabase/functions/scanner-ingest/index.ts:166-250
   - **Impact:** 50% faster barcode scanning (4-6s → 2-3s)
   - **Deployed:** Yes, live on Supabase edge functions

### 🟡 **P1 - High Priority (Next Week - EDGE FUNCTIONS ONLY, NOT BarcodeScanner.js)**

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

### **Week 1: P0 Critical Fixes** ✅ COMPLETE
**Goal:** Prevent data corruption and storage bloat

| Priority | Issue | Effort | Files | Status |
|----------|-------|--------|-------|--------|
| P0 | Add cleanup job for stuck pending items | Low | Migration 20251128000000 | ✅ |
| P0 | Fix orphaned photo storage | Medium | Migration 20251128000001 | ✅ |
| P0 | Add error boundary for crash recovery | Low | ScannerErrorBoundary.tsx | ✅ |

**Completed:** November 28, 2025

### **Week 2: P1 High-Value Improvements** ✅ 2/3 COMPLETE
**Goal:** Quick wins for UX and best practices

| Priority | Issue | Effort | Files | Status |
|----------|-------|--------|-------|--------|
| P1 | Parallelize API calls (UPC + OFF) | Low | scanner-ingest/index.ts:166-250 | ✅ |
| P1 | Add Sentry error tracking | Low | app/_layout.tsx, ScannerErrorBoundary.tsx | ✅ |
| P1 | Remove hardcoded household ID | Low | BarcodeScanner.js:42 | ⚠️ DEFERRED |

**Completed:** November 29, 2025
- Parallelized API calls (scanner-ingest edge function using Promise.allSettled)
- Sentry installed (@sentry/react-native v7.7.0, configured in app/_layout.tsx)
- Error boundary integration (ScannerErrorBoundary.tsx sends errors to Sentry)

**Deferred:** Remove hardcoded household ID (requires BarcodeScanner.js changes, wait for state machine rewrite)

### **Month 1-2: P2 Quality Improvements**
**Goal:** Improve data quality and prepare for scale

| Priority | Issue | Effort | Files |
|----------|-------|--------|-------|
| P2 | Add idempotency keys | Medium | scanner-ingest, identify-by-photo |
| P2 | Fix AI Vision variety names | Low | identify-by-photo:178-189 |
| P2 | Add request deduplication | Medium | Multiple locations |

### **Week 3-4: State Machine Rewrite** 🟡 IN PROGRESS
**Goal:** Replace BarcodeScanner.js with XState state machine

#### Phase 1: Machine Implementation ✅ COMPLETE
- ✅ Install XState v5 and implement scanner state machine (Nov 29)
- ✅ Write comprehensive unit tests (19/19 passing)
- ✅ Refactor to XState v5 patterns (inline guards for invoke completions)
- ✅ Create React Native mocks for Jest testing

#### Phase 2: UI Integration 🟡 IN PROGRESS (Dec 2025)
- 🟡 **Step 1: Create BarcodeScannerV2 skeleton** - IN PROGRESS
  - Created BarcodeScannerV2.tsx with useMachine integration
  - Zero useState hooks for workflow state
  - All UI derived from state.matches()
  - Feature flag: USE_STATE_MACHINE = __DEV__
- ⏳ Step 2: Camera flow (permissions, barcode detection)
- ⏳ Step 3: Processing flow (location, expiration, review)
- ⏳ Step 4: Error & complete states
- ⏳ Step 5: Device testing and verification

#### Phase 3: Additional Workflows (Deferred to Week 5+)
- PLU workflow
- Photo workflow
- Manual entry workflow
- Crash recovery

**Files:**
- machines/scanner.machine.ts (687 lines, tested)
- machines/__tests__/scanner.machine.test.ts (709 lines, 19 tests)
- components/BarcodeScannerV2.tsx (NEW - Phase 2)
- utils/featureFlags.ts (NEW)

### **Deferred: P3-P5 (High Effort, Low Urgency)**
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

### **Week 1: Stabilize (P0 - Database & Wrapper Only)** ✅ COMPLETE
1. ✅ Add pg_cron job for stuck pending items (migration)
2. ✅ Add orphaned photo cleanup function (migration)
3. ✅ Wrap BarcodeScanner with ErrorBoundary (wrapper component)
4. ✅ Add reset button to error boundary

**Completed:** November 28, 2025 - Data integrity protected without touching fragile code

### **Week 2: Edge Function Improvements (P1 - NOT BarcodeScanner.js)** ✅ 2/3 COMPLETE
1. ✅ Parallelize API calls in scanner-ingest edge function (Promise.allSettled)
2. ✅ Add Sentry error tracking (monitoring only)
3. ❌ Add idempotency keys to edge functions (P2 - deferred)

**Completed:** November 29, 2025
- 50% faster barcode scanning (4-6s → 2-3s) without touching BarcodeScanner.js
- Full error tracking enabled (@sentry/react-native, app/_layout.tsx, ScannerErrorBoundary.tsx)

### **Week 3: Design State Machine (Planning, No Code)** ✅ COMPLETE
1. ✅ Map all Scanner states (idle, scanning, reviewing, etc.)
2. ✅ Map all events (SCAN, SELECT_LOCATION, CONFIRM, etc.)
3. ✅ Map valid transitions (state diagram)
4. ✅ Review design (Desktop Claude peer review)

**Completed:** November 29, 2025
- `/Users/macmini/Desktop/docs/SCANNER_STATE_MACHINE_DESIGN_V3.1.md`
- All 4 workflows mapped (barcode, PLU, photo, manual)
- All implementation bugs fixed (photo workflow, retry state, async cleanup)
- Approved by Desktop Claude - ready for implementation

### **Week 4-5: Rewrite Scanner (XState)** 🟡 IN PROGRESS

**Phase 1: Core Infrastructure (Week 4)** - In Progress
1. ✅ Install XState v5 (`xstate@5`)
2. ✅ Create type definitions (`types/scanner.types.ts`)
3. ✅ Create state machine (`machines/scanner.machine.ts`)
4. ✅ Add Jest testing framework
5. 🟡 Write unit tests for barcode workflow (5/15 tests written)

**Completed:** November 29, 2025
- XState v5 installed
- Complete TypeScript types for context, events, states
- State machine with barcode workflow (camera permissions → scan → review → complete)
- All guards, actions, actors defined per V3.1 design
- Cleanup state for async deletePendingItem (V3.1 fix)
- **Explicit return types on all actors** (clearPendingScan, updateStatus, flagItemForReview, deletePendingItem: Promise<void>)
- Jest + ts-jest configured
- First 5 tests written (initial state, permissions flow, happy path start)

**Next:** Complete remaining 10 unit tests, verify all pass, then UI integration

**Phase 2-4:** (Not started)
2. ❌ Rebuild Scanner UI against machine (module by module)
3. ❌ Replace BarcodeScanner.js
4. ❌ Remove old code
5. ✅ THEN fix hardcoded household ID (safe after rewrite)

---

**Handoff Status:** Complete and Verified
**Code Quality:** B (functional but needs refactor)
**Data Integrity:** C (pending items + orphaned photos need fixes)
**Performance:** B- (sequential APIs slow scans)
**Security:** A (RLS, JWT, service role correct)
**Last Audit:** November 28, 2025
**Next Review:** After P0/P1 fixes (December 15, 2025)
