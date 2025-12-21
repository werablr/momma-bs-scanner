# Momma B's Scanner - User Acceptance Testing

**Purpose:** Comprehensive test and audit of all Scanner app features
**Approach:** Test everything, document issues, fix blockers only, batch remaining fixes after complete audit

---

## Test Session Information

| Field | Value |
|-------|-------|
| Test Date | |
| Tester Name | |
| App Version | |
| Device Model | |
| iOS Version | |
| Build Type | Development / Production |
| Supabase Project | bwglyyfcdjzvvjdxxjmk |
| Baseline Inventory Count | |

---

## Test Results Summary

| Metric | Count |
|--------|-------|
| Total Tests | 0 |
| Passed ✓ | 0 |
| Failed ✗ | 0 |
| Skipped ⊘ | 0 |
| Blockers 🚫 | 0 |

---

## 0. App Launch & Settings

### 0.1 Initial Launch

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| LAUNCH-001 | App launches successfully from cold start | | | |
| LAUNCH-002 | Splash screen displays | | | |
| LAUNCH-003 | App loads in < 3 seconds | | | |
| LAUNCH-004 | No crash on launch | | | |
| LAUNCH-005 | Background location/notification permissions requested (if applicable) | | | |

### 0.2 Settings/Profile Screen

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| SET-001 | Settings button/menu accessible | | | |
| SET-002 | Settings screen exists and displays | | | UAT-002, UAT-003 |
| SET-003 | User profile information displays | | | |
| SET-004 | Household name displays | | | |
| SET-005 | Account email displays | | | |
| SET-006 | Logout button visible | | | |
| SET-007 | Can access app version info | | | |
| SET-008 | Can access privacy policy | | | |
| SET-009 | Can access terms of service | | | |
| SET-010 | Settings changes persist | | | |

### 0.3 App Info Screen

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| INFO-001 | App info screen accessible | | | UAT-004 |
| INFO-002 | App version displays | | | |
| INFO-003 | Build number displays | | | |
| INFO-004 | Legal/about information accessible | | | |
| INFO-005 | Support/help links work | | | |

---

## 1. Authentication & Session Management

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| AUTH-001 | Login screen displays on first launch | | | |
| AUTH-002 | Email field accepts valid email input | | | |
| AUTH-003 | Password field masks input | | | |
| AUTH-004 | "Show password" toggle works | | | |
| AUTH-005 | Login with valid credentials succeeds | | | |
| AUTH-006 | Login with invalid email shows error | | | |
| AUTH-007 | Login with invalid password shows error | | | |
| AUTH-008 | "Forgot password" flow works | | | |
| AUTH-009 | Auth session persists after app restart | | | |
| AUTH-010 | Logout button visible when authenticated | | | |
| AUTH-011 | Logout shows confirmation dialog | | | |
| AUTH-012 | Logout clears session completely | | | |
| AUTH-013 | Logout returns to login screen | | | |
| AUTH-014 | Household assignment correct after login | | | |
| AUTH-015 | Session expires after timeout (if configured) | | | |

---

## 2. Barcode Scan Workflow

### 2.1 Camera & Scanning

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| BAR-001 | Camera permission requested on first use | | | |
| BAR-002 | Camera opens after permission granted | | | |
| BAR-003 | Camera permission denied shows error message | | | |
| BAR-004 | Error message explains how to enable camera | | | |
| BAR-005 | Can open Settings from camera permission error | | | |
| BAR-006 | Camera focuses correctly | | | |
| BAR-007 | Scan target/guide visible on screen | | | |
| BAR-008 | Flashlight toggle button visible | | | |
| BAR-009 | Flashlight turns on when toggled | | | |
| BAR-010 | Flashlight turns off when toggled again | | | |
| BAR-011 | Flashlight state persists during scan session | | | |
| BAR-012 | UPC-A barcode (12 digits) scans successfully | | | |
| BAR-013 | UPC-E barcode (8 digits) scans successfully | | | |
| BAR-014 | EAN-13 barcode (13 digits) scans successfully | | | |
| BAR-015 | EAN-8 barcode (8 digits) scans successfully | | | |
| BAR-016 | Scan provides haptic feedback (vibration) | | | |
| BAR-017 | Scan provides visual feedback | | | |
| BAR-018 | Scan provides audio feedback (optional) | | | |
| BAR-019 | Multiple rapid scans don't cause duplicate processing | | | |
| BAR-020 | Can cancel/back out of camera view | | | |
| BAR-021 | Barcode value captured correctly | | | |
| BAR-022 | Camera stops when navigating away | | | |

### 2.2 Storage Location Selection

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| LOC-001 | Location picker appears after successful scan | | | |
| LOC-002 | All storage locations display in picker | | | |
| LOC-003 | Location names clear and readable | | | |
| LOC-004 | Location icons/visual indicators display | | | |
| LOC-005 | "Recommended" label appears if applicable | | | |
| LOC-006 | Recommended logic correct (freezer for frozen, etc.) | | | |
| LOC-007 | Can select "Refrigerator" location | | | |
| LOC-008 | Can select "Freezer" location | | | |
| LOC-009 | Can select "Pantry" location | | | |
| LOC-010 | Can select all other available locations | | | |
| LOC-011 | Selected location highlights visually | | | |
| LOC-012 | Can change location selection before confirm | | | |
| LOC-013 | Previously selected location remembered for next scan | | | |
| LOC-014 | Can cancel/back out of location picker | | | |
| LOC-015 | Confirm location proceeds to API lookup | | | |
| LOC-016 | Location categories organized logically | | | |

### 2.3 API Lookup & Product Enrichment

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| API-001 | Loading indicator displays during API lookup | | | |
| API-002 | Loading indicator shows progress message | | | |
| API-003 | Product found in OpenFoodFacts populates data | | | |
| API-004 | Product found in UPCitemdb populates data | | | |
| API-005 | Product found in both APIs uses correct priority (OFF > UPC) | | | |
| API-006 | Product not found in any API shows error | | | |
| API-007 | Product not found error message clear | | | |
| API-008 | Can retry API lookup after error | | | |
| API-009 | Can switch to manual entry from product not found | | | |
| API-010 | API timeout handled gracefully | | | |
| API-011 | API timeout shows user-friendly message | | | |
| API-012 | Network error handled gracefully | | | |
| API-013 | Network error shows retry option | | | |
| API-014 | OFF nutrition data (off_*) saved correctly | | | |
| API-015 | UPC data saved correctly | | | |
| API-016 | Package size parsed from title correctly | | | |
| API-017 | Product cached in product_catalog | | | |
| API-018 | Second scan of same barcode uses cache | | | |
| API-019 | Cache hit shows faster response | | | |
| API-020 | Malformed API response handled gracefully | | | |

### 2.4 Product Review & Edit Screen

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| REV-001 | Product review screen appears after API lookup | | | |
| REV-002 | Product photo displays (if available) | | | |
| REV-003 | Product photo scales correctly | | | |
| REV-004 | Photo placeholder shown if no image available | | | |
| REV-005 | Product name displays correctly | | | |
| REV-006 | Product name field is editable | | | |
| REV-007 | Can clear and re-type product name | | | |
| REV-008 | Product name accepts long names (200+ chars) | | | |
| REV-009 | Product name accepts special characters | | | |
| REV-010 | Product name accepts unicode/emoji | | | |
| REV-011 | Brand name displays correctly | | | |
| REV-012 | Brand field is editable | | | |
| REV-013 | Brand field can be left empty | | | |
| REV-014 | Package size amount displays | | | |
| REV-015 | Package size amount is editable | | | |
| REV-016 | Package size amount accepts decimal values | | | |
| REV-017 | Package size unit displays (oz, g, lb, ml, etc.) | | | |
| REV-018 | Package size unit is editable via picker | | | |
| REV-019 | Package size unit picker shows all options | | | |
| REV-020 | Package description field displays | | | |
| REV-021 | Package description is editable | | | |
| REV-022 | Nutrition facts section displays | | | |
| REV-023 | Calories value displays | | | |
| REV-024 | Protein value displays | | | |
| REV-025 | Carbohydrates value displays | | | |
| REV-026 | Fat value displays | | | |
| REV-027 | Serving size displays | | | |
| REV-028 | Nutriscore grade displays (if available) | | | |
| REV-029 | Nova group displays (if available) | | | |
| REV-030 | Ecoscore displays (if available) | | | |
| REV-031 | Quantity toggle displays ("each" vs "weight") | | | |
| REV-032 | Can switch quantity mode from "each" to "weight" | | | |
| REV-033 | Can switch quantity mode from "weight" to "each" | | | |
| REV-034 | Quantity scroll picker displays | | | |
| REV-035 | Quantity picker scrolls smoothly | | | |
| REV-036 | Quantity picker shows correct units based on mode | | | |
| REV-037 | Can select quantity 1 | | | |
| REV-038 | Can select quantity 2-10 | | | |
| REV-039 | Can select large quantities (>10) | | | |
| REV-040 | Quantity picker wraps correctly at boundaries | | | |
| REV-041 | "Flag for Review" button visible | | | |
| REV-042 | "Flag for Review" button works | | | |
| REV-043 | "Flag for Review" saves item with flag | | | |
| REV-044 | "Approve with Edits" button visible | | | |
| REV-045 | "Approve with Edits" button enabled after editing | | | |
| REV-046 | "Approve with Edits" proceeds to expiration | | | |
| REV-047 | Edited values override API data | | | |
| REV-048 | Continue/Next button visible | | | |
| REV-049 | Continue button proceeds to expiration capture | | | |
| REV-050 | Cancel button visible | | | |
| REV-051 | Cancel button shows confirmation dialog | | | |
| REV-052 | Cancel discards scan and returns to camera | | | |
| REV-053 | Keyboard dismisses when tapping outside | | | |
| REV-054 | Screen scrolls to show fields above keyboard | | | |

### 2.5 Expiration Date Capture

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| EXP-001 | Expiration screen appears after review | | | |
| EXP-002 | OCR camera mode available | | | |
| EXP-003 | OCR camera activates when selected | | | |
| EXP-004 | OCR camera target/guide displays | | | |
| EXP-005 | OCR detects date on package | | | |
| EXP-006 | OCR confidence score displays | | | |
| EXP-007 | OCR extracted date displays clearly | | | |
| EXP-008 | OCR date format correct (MM/DD/YYYY or locale) | | | |
| EXP-009 | Can accept OCR result | | | |
| EXP-010 | Can reject OCR result | | | |
| EXP-011 | Rejecting OCR shows manual picker | | | |
| EXP-012 | Manual date picker button visible | | | |
| EXP-013 | Manual date picker activates | | | |
| EXP-014 | Can select month in date picker | | | |
| EXP-015 | Can select day in date picker | | | |
| EXP-016 | Can select year in date picker | | | |
| EXP-017 | Date picker defaults to reasonable future date | | | |
| EXP-018 | Date picker allows selection 1+ years in future | | | |
| EXP-019 | Past date selection prevented or warned | | | UAT-011 BLOCKER |
| EXP-020 | Today's date allowed as expiration | | | |
| EXP-021 | Invalid dates rejected (Feb 31, etc.) | | | |
| EXP-022 | "No Expiration" option visible | | | |
| EXP-023 | "No Expiration" button works | | | |
| EXP-024 | "No Expiration" saves null to database | | | |
| EXP-025 | "Skip" or "Enter Later" option available | | | |
| EXP-026 | Skip proceeds without expiration date | | | |
| EXP-027 | Can cancel/back out to review screen | | | |
| EXP-028 | OCR text saved to ocr_text field | | | |
| EXP-029 | OCR confidence saved to ocr_confidence field | | | |
| EXP-030 | OCR processing time logged | | | |

### 2.6 Final Confirmation & Save

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| SAVE-001 | Final confirmation screen displays (if applicable) | | | |
| SAVE-002 | Summary of item details displays | | | |
| SAVE-003 | Product name shown in summary | | | |
| SAVE-004 | Quantity shown in summary | | | |
| SAVE-005 | Location shown in summary | | | |
| SAVE-006 | Expiration shown in summary | | | |
| SAVE-007 | Confirm/Save button visible and enabled | | | |
| SAVE-008 | Save button shows loading state during save | | | |
| SAVE-009 | Save button disabled while saving | | | |
| SAVE-010 | Success confirmation displays after save | | | |
| SAVE-011 | Success animation/feedback plays | | | |
| SAVE-012 | Success message includes item name | | | |
| SAVE-013 | Success screen auto-dismisses after timeout | | | |
| SAVE-014 | "Scan Another" button visible on success | | | |
| SAVE-015 | "Scan Another" returns to camera | | | |
| SAVE-016 | "View Item" button visible on success (if applicable) | | | |
| SAVE-017 | "View Item" navigates to item detail | | | |
| SAVE-018 | Item saved with status='active' | | | |
| SAVE-019 | Quantity creates multiple items if > 1 | | | |
| SAVE-020 | Multiple items have unique IDs | | | |
| SAVE-021 | Can navigate back to home/list after save | | | |
| SAVE-022 | Saved item appears in Pantry app immediately | | | |

### 2.7 Idempotency & Deduplication

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| IDEM-001 | Rapid double-tap Save doesn't create duplicates | | | |
| IDEM-002 | Same barcode scanned within 24hrs uses cache | | | |
| IDEM-003 | Idempotency key generated correctly | | | |
| IDEM-004 | Idempotency key stored in database | | | |
| IDEM-005 | Cached response returned for duplicate request | | | |
| IDEM-006 | Cached response expires after 24hrs | | | |

### 2.8 Error Recovery

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| ERR-001 | "Product Not Found" screen displays clearly | | | |
| ERR-002 | "Product Not Found" explains what happened | | | |
| ERR-003 | Retry button visible on product not found | | | |
| ERR-004 | Retry button re-queries APIs | | | |
| ERR-005 | "Enter Manually" button visible on product not found | | | |
| ERR-006 | "Enter Manually" switches to manual entry workflow | | | |
| ERR-007 | "Enter Manually" pre-fills barcode value | | | |
| ERR-008 | Network error shows retry option | | | |
| ERR-009 | Network error retry works when back online | | | |
| ERR-010 | Save error shows user-friendly message | | | |
| ERR-011 | Save error allows retry | | | |
| ERR-012 | Can cancel/back out from error screens | | | |

---

## 3. PLU Code Workflow

### 3.1 Mode Switch & Entry

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PLU-001 | PLU button/tab visible in UI | | | |
| PLU-002 | PLU button labeled clearly | | | |
| PLU-003 | Can switch to PLU mode from camera | | | |
| PLU-004 | Barcode camera stops when switching to PLU | | | |
| PLU-005 | PLU entry screen displays | | | |
| PLU-006 | PLU keypad displays (if custom) | | | |
| PLU-007 | Numeric keyboard appears (if standard) | | | |
| PLU-008 | Numbers 0-9 work on keypad | | | |
| PLU-009 | Backspace/delete button works | | | |
| PLU-010 | Clear all button works | | | |
| PLU-011 | PLU field shows entered digits | | | |
| PLU-012 | PLU field shows placeholder/hint | | | |
| PLU-013 | PLU field validates format (4-5 digits) | | | |
| PLU-014 | Submit/lookup button visible | | | |
| PLU-015 | Submit button disabled until valid PLU entered | | | |
| PLU-016 | Submit button enabled for valid PLU | | | |
| PLU-017 | Can cancel/back out of PLU entry | | | |
| PLU-018 | Switching modes doesn't lose entered data (or warns) | | | |

### 3.2 PLU Lookup

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PLU-030 | Loading state displays during lookup | | | |
| PLU-031 | Valid 4-digit PLU works (e.g., 4011 banana) | | | |
| PLU-032 | Valid 5-digit PLU works (e.g., 94011 organic banana) | | | |
| PLU-033 | Invalid PLU format shows validation error | | | |
| PLU-034 | PLU not in database shows "not found" error | | | |
| PLU-035 | "Not found" error message clear | | | |
| PLU-036 | Can retry different PLU after not found | | | |
| PLU-037 | USDA nutrition data returned for valid PLU | | | |
| PLU-038 | Product name from PLU database displays | | | |
| PLU-039 | usda_* fields populated correctly | | | |
| PLU-040 | usda_fdc_id saved | | | |

### 3.3 Location & Review

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PLU-050 | Location picker appears after PLU lookup | | | |
| PLU-051 | All locations display | | | |
| PLU-052 | Can select location | | | |
| PLU-053 | Product review screen displays | | | |
| PLU-054 | Product name displays (from PLU database) | | | |
| PLU-055 | Product name is editable | | | |
| PLU-056 | USDA nutrition displays correctly | | | |
| PLU-057 | Calories display | | | |
| PLU-058 | Protein displays | | | |
| PLU-059 | Carbs display | | | |
| PLU-060 | Fat displays | | | |
| PLU-061 | Fiber displays | | | |
| PLU-062 | Sugars display | | | |
| PLU-063 | Sodium displays | | | |
| PLU-064 | Vitamins/minerals display (if available) | | | |
| PLU-065 | Quantity selection available | | | |
| PLU-066 | Package size fields available | | | |

### 3.4 Expiration, Quantity & Save

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PLU-080 | Expiration date capture works (OCR + manual) | | | |
| PLU-081 | "No Expiration" option works | | | |
| PLU-082 | Can skip expiration | | | |
| PLU-083 | Quantity input works | | | |
| PLU-084 | Can adjust quantity | | | |
| PLU-085 | Save button works | | | |
| PLU-086 | Item saved with PLU as barcode | | | |
| PLU-087 | USDA data saved correctly in usda_* fields | | | |
| PLU-088 | usda_raw_data saved | | | |
| PLU-089 | data_sources.usda = true | | | |
| PLU-090 | Status set to 'active' | | | |
| PLU-091 | Success confirmation displays | | | |

---

## 4. Photo/AI Vision Workflow

### 4.1 Mode Switch & Photo Capture

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PHO-001 | Photo button/tab visible in UI | | | |
| PHO-002 | Photo button labeled clearly | | | |
| PHO-003 | Can switch to photo mode | | | |
| PHO-004 | Camera opens in photo mode (not scan mode) | | | |
| PHO-005 | Photo capture button visible | | | |
| PHO-006 | Can take photo | | | |
| PHO-007 | Photo capture provides feedback | | | |
| PHO-008 | Photo preview displays after capture | | | |
| PHO-009 | Photo preview shows full image | | | |
| PHO-010 | Can retake photo | | | |
| PHO-011 | Retake clears previous photo | | | |
| PHO-012 | Can accept photo | | | |
| PHO-013 | Can cancel/back out before upload | | | |
| PHO-014 | Flash/flashlight works in photo mode | | | |

### 4.2 AI Processing & Identification

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PHO-030 | Photo uploads successfully | | | |
| PHO-031 | Upload progress indicator displays | | | |
| PHO-032 | Loading state displays during AI processing | | | |
| PHO-033 | AI processing message displays ("Identifying product...") | | | |
| PHO-034 | GPT-4o identifies product from photo | | | |
| PHO-035 | PLU code extracted from AI response | | | |
| PHO-036 | Product name from AI displays | | | |
| PHO-037 | Confidence score displayed (if any) | | | |
| PHO-038 | Low confidence shows warning | | | |
| PHO-039 | Can override AI identification | | | |
| PHO-040 | AI failure handled gracefully | | | |
| PHO-041 | AI failure shows user-friendly error | | | |
| PHO-042 | Can retry AI processing | | | |
| PHO-043 | Can switch to manual entry from AI failure | | | |
| PHO-044 | Timeout handled gracefully | | | |
| PHO-045 | Upload failure handled gracefully | | | |

### 4.3 USDA Lookup & Data Flow

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PHO-060 | PLU from AI triggers USDA lookup automatically | | | |
| PHO-061 | USDA nutrition data returned | | | |
| PHO-062 | Product name from USDA displays | | | |
| PHO-063 | Can keep AI product name vs USDA name | | | |
| PHO-064 | Location picker appears | | | |
| PHO-065 | Product review screen displays | | | |
| PHO-066 | AI-identified product name shows | | | |
| PHO-067 | USDA nutrition displays | | | |
| PHO-068 | Can edit product name | | | |
| PHO-069 | Can fully override AI identification | | | |
| PHO-070 | Photo saved/linked to item | | | |

### 4.4 Expiration, Quantity & Save

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| PHO-090 | Expiration capture works | | | |
| PHO-091 | Quantity input works | | | |
| PHO-092 | Save button works | | | |
| PHO-093 | Photo stored correctly | | | |
| PHO-094 | Photo URL saved to database | | | |
| PHO-095 | Item saved with correct data | | | |
| PHO-096 | PLU from AI saved as barcode | | | |
| PHO-097 | USDA data populated | | | |

---

## 5. Manual Entry Workflow

### 5.1 Mode Switch & Basic Entry

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| MAN-001 | Manual entry button/tab visible | | | |
| MAN-002 | Manual entry button labeled clearly | | | |
| MAN-003 | Can switch to manual mode | | | |
| MAN-004 | Manual entry screen displays | | | |
| MAN-005 | Instructions/help text visible | | | |
| MAN-006 | Product name field visible | | | |
| MAN-007 | Product name field has placeholder text | | | |
| MAN-008 | Keyboard appears on tap | | | |
| MAN-009 | Can type product name | | | |
| MAN-010 | Product name field validates (not empty) | | | |
| MAN-011 | Can clear product name field | | | |
| MAN-012 | Product name accepts long text (200+ chars) | | | |
| MAN-013 | Product name accepts special characters | | | |
| MAN-014 | Product name accepts unicode/emoji | | | |
| MAN-015 | Brand name field visible | | | |
| MAN-016 | Brand name field labeled as optional | | | |
| MAN-017 | Brand name field has placeholder | | | |
| MAN-018 | Can type brand name | | | |
| MAN-019 | Can leave brand name empty | | | |
| MAN-020 | Can clear brand name field | | | |

### 5.2 Location & Additional Fields

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| MAN-040 | Location selection field visible | | | |
| MAN-041 | Location picker button works | | | |
| MAN-042 | Location picker shows all locations | | | |
| MAN-043 | Can select location | | | |
| MAN-044 | Selected location displays in field | | | |
| MAN-045 | Category field visible (if applicable) | | | |
| MAN-046 | Can select category | | | |
| MAN-047 | Expiration date field visible | | | |
| MAN-048 | Expiration date picker works | | | |
| MAN-049 | Can select expiration date | | | |
| MAN-050 | Can skip/clear expiration date | | | |
| MAN-051 | Past dates prevented/warned | | | |
| MAN-052 | Notes field visible (if exists) | | | |
| MAN-053 | Can enter notes | | | |
| MAN-054 | Notes field has character limit (or none) | | | |
| MAN-055 | Notes are optional | | | |
| MAN-056 | Package size fields visible | | | |
| MAN-057 | Can enter package amount | | | |
| MAN-058 | Can select package unit | | | |
| MAN-059 | Quantity selection available | | | |
| MAN-060 | Can adjust quantity | | | |

### 5.3 API Enrichment

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| MAN-080 | Save/Continue triggers API enrichment | | | |
| MAN-081 | Loading state displays during API enrichment | | | |
| MAN-082 | Loading message indicates nutrition lookup | | | |
| MAN-083 | OFF search by product name executes | | | |
| MAN-084 | USDA search by product name executes | | | |
| MAN-085 | APIs called in parallel | | | |
| MAN-086 | Search query includes brand + product name | | | |
| MAN-087 | Search query works with product name only | | | |
| MAN-088 | OFF nutrition data (off_*) populated if found | | | |
| MAN-089 | USDA nutrition data (usda_*) populated if found | | | |
| MAN-090 | No nutrition data found handled gracefully | | | |
| MAN-091 | Partial results handled (OFF found, USDA not) | | | |
| MAN-092 | Partial results handled (USDA found, OFF not) | | | |
| MAN-093 | data_sources shows which APIs matched | | | |
| MAN-094 | enrichment response shows off_found status | | | |
| MAN-095 | enrichment response shows usda_found status | | | |
| MAN-096 | API enrichment doesn't block save | | | |
| MAN-097 | Can save even if APIs fail | | | |

### 5.4 Data Integrity - API Enrichment Boundaries

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| MAN-120 | brand_name = user input ONLY (not from API) | | | |
| MAN-121 | food_name = user input ONLY (not from API) | | | |
| MAN-122 | serving_qty = NULL | | | |
| MAN-123 | serving_unit = NULL | | | |
| MAN-124 | serving_weight_grams = NULL | | | |
| MAN-125 | photo_thumb = NULL | | | |
| MAN-126 | photo_highres = NULL | | | |
| MAN-127 | package_size = NULL (unless user entered) | | | |
| MAN-128 | package_unit = NULL (unless user entered) | | | |
| MAN-129 | nutriscore_grade = NULL | | | |
| MAN-130 | nova_group = NULL | | | |
| MAN-131 | ecoscore_grade = NULL | | | |
| MAN-132 | nutrient_levels = NULL | | | |
| MAN-133 | is_vegan = NULL | | | |
| MAN-134 | is_vegetarian = NULL | | | |
| MAN-135 | is_palm_oil_free = NULL | | | |
| MAN-136 | allergens = NULL | | | |
| MAN-137 | traces = NULL | | | |
| MAN-138 | labels = NULL | | | |
| MAN-139 | labels_tags = NULL | | | |
| MAN-140 | packaging_type = NULL | | | |
| MAN-141 | packaging_tags = NULL | | | |
| MAN-142 | manufacturing_places = NULL | | | |
| MAN-143 | origins = NULL | | | |
| MAN-144 | countries = NULL | | | |

### 5.5 Final Save

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| MAN-160 | Save button visible and labeled clearly | | | |
| MAN-161 | Save button disabled until required fields filled | | | |
| MAN-162 | Save button enabled when valid | | | |
| MAN-163 | Save button shows loading state | | | |
| MAN-164 | Item saved successfully | | | |
| MAN-165 | barcode = MANUAL-{timestamp} format | | | |
| MAN-166 | barcode timestamp is current | | | |
| MAN-167 | barcode is unique | | | |
| MAN-168 | food_name = user input exactly | | | |
| MAN-169 | brand_name = user input or NULL | | | |
| MAN-170 | usda_* nutrition populated (if API found) | | | |
| MAN-171 | off_* nutrition populated (if API found) | | | |
| MAN-172 | usda_raw_data contains full API response | | | |
| MAN-173 | data_sources.usda accurate | | | |
| MAN-174 | data_sources.openfoodfacts accurate | | | |
| MAN-175 | data_sources.upcitemdb = false | | | |
| MAN-176 | status = 'active' or 'pending' correctly | | | |
| MAN-177 | volume_remaining = 100 | | | |
| MAN-178 | household_id correct | | | |
| MAN-179 | storage_location_id correct | | | |
| MAN-180 | created_at timestamp set | | | |
| MAN-181 | Success confirmation displays | | | |
| MAN-182 | Can add another item | | | |

---

## 6. Navigation & Tab Switching

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| NAV-001 | Tab bar/mode switcher visible at all times | | | |
| NAV-002 | All tabs/modes labeled clearly | | | |
| NAV-003 | Current tab/mode highlighted | | | |
| NAV-004 | Can switch from Barcode to PLU | | | |
| NAV-005 | Can switch from Barcode to Photo | | | |
| NAV-006 | Can switch from Barcode to Manual | | | |
| NAV-007 | Can switch from PLU to Barcode | | | |
| NAV-008 | Can switch from PLU to Photo | | | |
| NAV-009 | Can switch from PLU to Manual | | | |
| NAV-010 | Can switch from Photo to Barcode | | | |
| NAV-011 | Can switch from Photo to PLU | | | |
| NAV-012 | Can switch from Photo to Manual | | | |
| NAV-013 | Can switch from Manual to Barcode | | | |
| NAV-014 | Can switch from Manual to PLU | | | |
| NAV-015 | Can switch from Manual to Photo | | | |
| NAV-016 | Switching tabs warns if data will be lost | | | |
| NAV-017 | Switching tabs preserves data (or appropriately discards) | | | |
| NAV-018 | Back button works on all screens | | | |
| NAV-019 | Back button behaves correctly in workflow | | | |
| NAV-020 | Swipe back gesture works (iOS) | | | |
| NAV-021 | Can return to home/scan from any screen | | | |
| NAV-022 | Home button visible (if applicable) | | | |
| NAV-023 | Navigation state preserved during backgrounding | | | |
| NAV-024 | Deep links work (if applicable) | | | |

---

## 7. UI/UX & General Polish

### 7.1 Theme & Branding

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| UI-001 | Momma B's brand colors display correctly | | | |
| UI-002 | Color scheme consistent across all screens | | | |
| UI-003 | Fonts render correctly | | | |
| UI-004 | Font sizes readable | | | |
| UI-005 | Icons display correctly | | | |
| UI-006 | Icons have consistent style | | | |
| UI-007 | Logo/branding visible where appropriate | | | |
| UI-008 | Dark mode supported (if applicable) | | | |
| UI-009 | Dark mode colors correct | | | |
| UI-010 | Dark mode doesn't break UI | | | |
| UI-011 | Status bar styling correct (light/dark) | | | |
| UI-012 | Safe area insets respected (iPhone notch/island) | | | |

### 7.2 Keyboard & Input Handling

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| UI-030 | Keyboard appears when tapping input fields | | | |
| UI-031 | Correct keyboard type for field (numeric, email, etc.) | | | |
| UI-032 | Keyboard dismisses on tap outside | | | |
| UI-033 | Keyboard dismisses on "Done" button | | | |
| UI-034 | Keyboard dismisses on submit | | | |
| UI-035 | Screen scrolls to show field above keyboard | | | |
| UI-036 | Input fields not hidden by keyboard | | | |
| UI-037 | Return/Done key works correctly | | | |
| UI-038 | Tab/Next moves to next field (if multi-field form) | | | |
| UI-039 | Keyboard toolbar visible (if custom) | | | |

### 7.3 Loading, Error & Success States

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| UI-060 | Loading spinners/indicators display clearly | | | |
| UI-061 | Loading messages informative | | | |
| UI-062 | Buttons disabled during processing | | | |
| UI-063 | No double-submissions possible | | | |
| UI-064 | Loading states don't block critical UI | | | |
| UI-065 | Error messages display clearly | | | |
| UI-066 | Error messages use plain language | | | |
| UI-067 | Error messages actionable (suggest fix) | | | |
| UI-068 | Can dismiss error messages | | | |
| UI-069 | Error dismiss button labeled clearly | | | |
| UI-070 | Can retry after error | | | |
| UI-071 | Errors don't crash app | | | |
| UI-072 | Errors logged for debugging | | | |
| UI-073 | Success confirmation displays clearly | | | |
| UI-074 | Success animation plays (if designed) | | | |
| UI-075 | Success messages use positive language | | | |
| UI-076 | Success auto-dismisses after timeout | | | |
| UI-077 | Success timeout duration appropriate (2-3s) | | | |
| UI-078 | Can manually dismiss success message | | | |

### 7.4 Animations & Transitions

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| UI-090 | Screen transitions smooth | | | |
| UI-091 | No janky animations | | | |
| UI-092 | Animation timing feels natural | | | |
| UI-093 | Modal presentations smooth | | | |
| UI-094 | Modal dismissals smooth | | | |
| UI-095 | Scroll performance smooth | | | |
| UI-096 | Lists scroll without lag | | | |
| UI-097 | Pull-to-refresh works (if applicable) | | | |

---

## 8. Edge Cases & Error Handling

### 8.1 Network Conditions

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| EDGE-001 | Offline detection works | | | |
| EDGE-002 | Offline banner/message displays | | | |
| EDGE-003 | Offline error message clear | | | |
| EDGE-004 | Retry works when back online | | | |
| EDGE-005 | Slow connection handled gracefully | | | |
| EDGE-006 | Slow connection shows loading state | | | |
| EDGE-007 | API timeout handled (don't hang forever) | | | |
| EDGE-008 | Timeout shows user-friendly error | | | |
| EDGE-009 | Partial response handled | | | |
| EDGE-010 | Intermittent connection handled | | | |

### 8.2 Permissions

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| EDGE-020 | Camera permission denied shows error | | | |
| EDGE-021 | Camera error explains how to fix | | | |
| EDGE-022 | Can prompt to open Settings | | | |
| EDGE-023 | Open Settings button works | | | |
| EDGE-024 | Returning from Settings resumes correctly | | | |
| EDGE-025 | Photo library permission works (if needed) | | | |
| EDGE-026 | Location permission works (if needed) | | | |

### 8.3 App Lifecycle

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| EDGE-040 | App backgrounded during scan preserves state | | | |
| EDGE-041 | App resumed restores scan state | | | |
| EDGE-042 | App killed during scan recovers gracefully | | | |
| EDGE-043 | App resumed restarts camera correctly | | | |
| EDGE-044 | Memory pressure handled | | | |
| EDGE-045 | Low memory doesn't crash app | | | |
| EDGE-046 | Low battery doesn't crash app | | | |
| EDGE-047 | Background tasks complete correctly | | | |

### 8.4 Data Edge Cases

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| EDGE-060 | Very long product name (200+ chars) handled | | | |
| EDGE-061 | Special characters in product name handled | | | |
| EDGE-062 | Unicode/emoji in product name handled | | | |
| EDGE-063 | Empty API responses handled | | | |
| EDGE-064 | Malformed API responses handled | | | |
| EDGE-065 | Missing required fields handled | | | |
| EDGE-066 | Null values handled correctly | | | |
| EDGE-067 | Zero/negative nutrition values handled | | | |
| EDGE-068 | Extremely large nutrition values handled | | | |

---

## 9. Database Integrity Verification

### 9.1 Barcode Workflow Data Integrity

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| DB-001 | Barcode saved correctly in inventory_items | | | |
| DB-002 | household_id correct | | | |
| DB-003 | storage_location_id correct | | | |
| DB-004 | food_name saved | | | |
| DB-005 | brand_name saved | | | |
| DB-006 | off_* fields populated (if OFF found) | | | |
| DB-007 | upc_* fields populated (if UPCitemdb found) | | | |
| DB-008 | usda_* fields NULL for barcode-only items | | | |
| DB-009 | expiration_date saved correctly | | | |
| DB-010 | expiration_date NULL if skipped | | | |
| DB-011 | status = 'active' after completion | | | |
| DB-012 | data_sources object accurate | | | |
| DB-013 | data_sources.openfoodfacts = true if OFF used | | | |
| DB-014 | data_sources.upcitemdb = true if UPC used | | | |
| DB-015 | created_at timestamp set | | | |
| DB-016 | updated_at timestamp set | | | |
| DB-017 | volume_remaining = 100 | | | |

### 9.2 PLU Workflow Data Integrity

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| DB-030 | barcode = PLU code (4-5 digits) | | | |
| DB-031 | usda_* fields populated | | | |
| DB-032 | usda_fdc_id saved | | | |
| DB-033 | usda_raw_data contains full response | | | |
| DB-034 | data_sources.usda = true | | | |
| DB-035 | data_sources.openfoodfacts = false | | | |
| DB-036 | data_sources.upcitemdb = false | | | |
| DB-037 | Product name from USDA saved | | | |

### 9.3 Photo Workflow Data Integrity

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| DB-050 | photo_url saved (if applicable) | | | |
| DB-051 | PLU from AI saved as barcode | | | |
| DB-052 | USDA data populated via PLU lookup | | | |
| DB-053 | AI confidence stored (if applicable) | | | |

### 9.4 Manual Entry Data Integrity

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| DB-070 | barcode = MANUAL-{timestamp} format | | | |
| DB-071 | barcode timestamp reasonable (not future, not old) | | | |
| DB-072 | barcode is unique | | | |
| DB-073 | food_name = user input exactly | | | |
| DB-074 | brand_name = user input or NULL | | | |
| DB-075 | brand_name NOT auto-filled from API | | | |
| DB-076 | usda_* nutrition populated (if API found) | | | |
| DB-077 | usda_* NULL if API not found | | | |
| DB-078 | off_* nutrition populated (if API found) | | | |
| DB-079 | off_* NULL if API not found | | | |
| DB-080 | usda_raw_data contains full response (if found) | | | |
| DB-081 | data_sources.usda accurate | | | |
| DB-082 | data_sources.openfoodfacts accurate | | | |
| DB-083 | data_sources.upcitemdb = false | | | |
| DB-084 | serving_qty = NULL | | | |
| DB-085 | serving_unit = NULL | | | |
| DB-086 | photo_thumb = NULL | | | |
| DB-087 | photo_highres = NULL | | | |
| DB-088 | package_size = NULL (unless user entered) | | | |
| DB-089 | nutriscore_grade = NULL | | | |
| DB-090 | nova_group = NULL | | | |
| DB-091 | allergens = NULL | | | |
| DB-092 | volume_remaining = 100 | | | |
| DB-093 | status = 'active' | | | |

### 9.5 Cross-App Verification (Pantry)

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| DB-110 | Items appear in Pantry app after scan | | | |
| DB-111 | Barcode items show in Pantry correctly | | | |
| DB-112 | PLU items show in Pantry correctly | | | |
| DB-113 | Photo items show in Pantry correctly | | | |
| DB-114 | Manual items show in Pantry correctly | | | |
| DB-115 | Nutrition displays correctly in Pantry | | | |
| DB-116 | Photos display correctly in Pantry | | | |
| DB-117 | Expiration dates display correctly | | | |
| DB-118 | Volume tracking works in Pantry | | | |
| DB-119 | Manual entries show nutrition in Pantry | | | |
| DB-120 | Data sources priority correct (USER > USDA > OFF > UPC) | | | |
| DB-121 | Package size displays in Pantry | | | |
| DB-122 | Health scores display in Pantry (if available) | | | |

---

## 10. State Machine Verification

| ID | Test Description | Status | Notes | Issue ID |
|----|------------------|--------|-------|----------|
| SM-001 | State machine starts in correct initial state | | | |
| SM-002 | State transitions follow defined paths | | | |
| SM-003 | Invalid transitions are prevented | | | |
| SM-004 | Context data preserved across transitions | | | |
| SM-005 | Error states handled correctly | | | |
| SM-006 | Can recover from error states | | | |
| SM-007 | State persisted during app backgrounding | | | |
| SM-008 | Guards prevent invalid state changes | | | |
| SM-009 | Actions execute at correct times | | | |
| SM-010 | Services manage async operations correctly | | | |

---

## Issue Tracking

### 🚫 Blocker Issues (Must Fix Before UAT Completion)

| Issue ID | Description | Found In | Status |
|----------|-------------|----------|--------|
| UAT-011 | Past date selection allowed in expiration picker | EXP-019 | |

### P1 Issues (High Priority - Fix Before Ship)

| Issue ID | Description | Found In | Status |
|----------|-------------|----------|--------|
| UAT-002 | Settings screen doesn't exist | SET-002 | |
| UAT-003 | No way to access profile/account info | SET-003 | |
| UAT-004 | App info screen not accessible | INFO-001 | |

### P2 Issues (Medium Priority - Fix This Sprint)

| Issue ID | Description | Found In | Status |
|----------|-------------|----------|--------|
| | | | |

### P3 Issues (Low Priority - Backlog)

| Issue ID | Description | Found In | Status |
|----------|-------------|----------|--------|
| | | | |

---

## Notes & Observations

**General Observations:**


**Performance Notes:**


**UX Feedback:**


**Technical Debt Identified:**


---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tester | | | |
| Product Owner (Brian) | | | |
| Desktop Claude | | | |

---

**End of UAT Document**
