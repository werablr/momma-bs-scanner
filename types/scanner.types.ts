/**
 * Scanner State Machine Types
 *
 * Based on SCANNER_STATE_MACHINE_DESIGN_V3.1.md
 * Phase 1: Barcode workflow types only
 */

// ============================================================================
// Context Interface (Workflow Data)
// ============================================================================

export interface ScannerContext {
  // Workflow tracking
  mode: 'barcode' | 'photo' | 'plu' | 'manual' | null

  // Input data (from user or camera)
  barcode: string | null
  barcodeType: string | null
  plu_code: string | null
  photo_base64: string | null

  // API responses
  product: ProductData | null
  matches: Match[] | null
  ai_result: AIResult | null

  // Workflow state
  storage_location_id: string | null
  expiration_date: Date | null
  ocr_text: string | null
  ocr_confidence: number | null
  quantity: number

  // Database tracking
  scan_id: string | null
  completed_item: InventoryItem | null

  // Photo upload
  photo_url: string | null

  // Manual entry
  manual_entry: ManualEntryData | null

  // Error handling
  error: ErrorInfo | null
  retry_state: string | null

  // Flag for review
  flag_reason: string | null
  flag_notes: string | null

  // Idempotency key for edge function deduplication
  idempotency_key: string | null
}

// ============================================================================
// Events (All Workflows)
// ============================================================================

export type ScannerEvent =
  // Navigation
  | { type: 'START_BARCODE_SCAN' }
  | { type: 'START_PHOTO_SCAN' }
  | { type: 'START_PLU_ENTRY' }
  | { type: 'START_MANUAL_ENTRY' }
  | { type: 'CANCEL' }
  | { type: 'SCAN_ANOTHER' }
  | { type: 'START_NEW_SCAN' }

  // Camera permissions
  | { type: 'OPEN_SETTINGS' }

  // Barcode workflow
  | { type: 'BARCODE_DETECTED'; barcode: string; barcodeType: string }

  // PLU workflow
  | { type: 'PLU_ENTERED'; plu_code: string }

  // Photo workflow
  | { type: 'PHOTO_CAPTURED'; photo_base64: string }

  // Match selection (PLU/Photo)
  | { type: 'MATCH_SELECTED'; match: Match; quantity?: number }

  // Manual entry
  | { type: 'SET_MANUAL_PRODUCT_NAME'; product_name: string }
  | { type: 'SET_MANUAL_BRAND'; brand_name?: string }
  | { type: 'MANUAL_ENTRY_SUBMITTED' }

  // Common workflow steps
  | { type: 'LOCATION_SELECTED'; location_id: string }
  | { type: 'EXPIRATION_CAPTURED'; date: Date; ocr_text: string; confidence: number }
  | { type: 'EXPIRATION_ENTERED'; date: Date }
  | { type: 'OCR_DETECTED'; date: Date }
  | { type: 'EXPIRATION_SKIPPED' }
  | { type: 'REVIEW_APPROVED' }
  | { type: 'REVIEW_REJECTED' }
  | { type: 'REVIEW_FLAGGED'; reason: string; notes: string }

  // Error handling
  | { type: 'RETRY' }
  | { type: 'MANUAL_ENTRY_FALLBACK' }

  // Crash recovery
  | { type: 'RESUME_SCAN' }
  | { type: 'DISCARD_PENDING' }
  | { type: 'RESUME' }
  | { type: 'DISCARD' }

// ============================================================================
// Data Types
// ============================================================================

export interface ProductData {
  // Edge function response fields (scanner-ingest Step 1)
  name?: string  // Returned as 'name' in response
  brand?: string  // Returned as 'brand' in response
  serving_size?: number
  serving_unit?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number

  // EditableReview expected fields
  brand_name?: string
  suggested_category?: string
  package_description?: string
  expiration_date?: string
  volume_amount?: number
  volume_unit?: string
  serving_qty?: number

  // Open Food Facts fields
  product_name?: string
  brands?: string
  barcode?: string
  nutrition?: NutritionData
  nutri_score?: string
  nova_group?: number

  // USDA specific
  fdc_id?: string
  ndb_number?: string
  food_code?: string
  gtin_upc?: string
  scientific_name?: string

  // Photo URLs
  image_url?: string
  image_thumb_url?: string
}

export interface NutritionData {
  energy_kcal?: number
  proteins?: number
  fat?: number
  carbohydrates?: number
  fiber?: number
  sugars?: number
  sodium?: number
  calcium?: number
  iron?: number
  potassium?: number
  serving_size?: string
  serving_unit?: string
}

export interface Match {
  product_name: string
  description?: string
  nutrition?: NutritionData
  fdc_id?: string
  quantity?: number
  confidence?: number
}

export interface AIResult {
  name: string
  confidence: number
  raw_response?: string
}

export interface ManualEntryData {
  food_name: string
  brand_name?: string
}

export interface InventoryItem {
  id: string
  household_id: string
  barcode: string
  storage_location_id: string

  // Product info
  food_name: string
  brand_name: string

  // Nutrition (multi-source)
  user_calories?: number
  usda_calories?: number
  off_calories?: number
  upc_calories?: number

  // ... (all nutrition fields)

  // Metadata
  status: 'pending' | 'active' | 'archived'
  quantity: number
  volume_percentage: number
  expiration_date?: string
  flagged_for_review: boolean
  flag_reason?: string
  flag_notes?: string

  created_at: string
  updated_at: string
}

export interface ErrorInfo {
  message: string
  code?: string | null
  type?: 'network' | 'timeout' | 'auth' | 'server' | 'unknown'
  retryable?: boolean
}

export interface StorageLocation {
  id: string
  household_id?: string
  name: string
  type: string  // 'pantry', 'fridge', 'freezer', etc.
  description?: string
  temperature_controlled?: boolean
  category_restrictions?: string[]
  created_at?: string
  icon?: string  // Optional - for UI display (derived from type)
}

// ============================================================================
// State Value Types (for type-safe state.matches())
// ============================================================================

export type ScannerStateValue =
  | 'checkingPermissions'
  | 'requestingPermission'
  | 'permissionDenied'
  | { ready: 'checkingForInterrupted' | 'interrupted' | 'idle' }
  | { scanning: 'barcode' | 'photo' | 'plu' | 'manual' }
  | { processing:
      | 'selectingLocation'
      | 'callingBarcodeAPI'
      | 'uploadingPhoto'
      | 'callingPhotoAPI'
      | 'lookingUpPLU'
      | 'identifyingWithAI'
      | 'selectingMatch'
      | 'capturingExpiration'
      | 'updatingExpiration'
      | 'savingManual'
      | 'manualEntry'
      | 'reviewing'
      | 'flagging'
      | 'finalizing'
      | 'cleaningUp'
    }
  | { error: 'retryable' | 'noMatches' | 'fatal' }
  | 'retry'
  | 'noProduct'
  | 'recoveryPrompt'
  | 'complete'

// ============================================================================
// Service Response Types
// ============================================================================

export interface Step1Response {
  success: boolean
  item_id: string
  product: ProductData
  suggested_category?: string  // From scanner-ingest line 426
  confidence_score?: number  // From scanner-ingest line 427
}

export interface Step2Response {
  success: boolean
}

export interface PLULookupResponse {
  matches: Match[]
}

export interface AIIdentifyResponse {
  ai_identification: AIResult
  matches: Match[]
}

export interface PhotoUploadResponse {
  photo_url: string
}

export interface PersistedScanData {
  scan_id: string | null
  context?: Partial<ScannerContext>
}

export interface CameraPermissionResponse {
  hasPermission: boolean
}

// ============================================================================
// Initial Context (Single Source of Truth for Reset)
// ============================================================================

export const initialScannerContext: ScannerContext = {
  mode: null,
  barcode: null,
  barcodeType: null,
  plu_code: null,
  photo_base64: null,
  product: null,
  matches: null,
  ai_result: null,
  storage_location_id: null,
  expiration_date: null,
  ocr_text: null,
  ocr_confidence: null,
  quantity: 1,
  scan_id: null,
  completed_item: null,
  photo_url: null,
  manual_entry: null,
  error: null,
  retry_state: null,
  flag_reason: null,
  flag_notes: null,
  idempotency_key: null,
}
