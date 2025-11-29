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
  | { type: 'FORM_SUBMITTED'; data: ManualEntryData }

  // Common workflow steps
  | { type: 'LOCATION_SELECTED'; location_id: string }
  | { type: 'EXPIRATION_CAPTURED'; date: Date; ocr_text: string; confidence: number }
  | { type: 'EXPIRATION_SKIPPED' }
  | { type: 'REVIEW_APPROVED' }
  | { type: 'REVIEW_FLAGGED'; reason: string; notes: string }

  // Error handling
  | { type: 'RETRY' }
  | { type: 'MANUAL_ENTRY_FALLBACK' }

  // Crash recovery
  | { type: 'RESUME' }
  | { type: 'DISCARD' }

// ============================================================================
// Data Types
// ============================================================================

export interface ProductData {
  product_name: string
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
  quantity: number
  storage_location_id: string
  expiration_date?: Date
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
  household_id: string
  name: string
  icon?: string
  created_at: string
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
      | 'reviewing'
      | 'flagging'
      | 'finalizing'
      | 'cleaningUp'
    }
  | { error: 'retryable' | 'noMatches' | 'fatal' }
  | 'complete'

// ============================================================================
// Service Response Types
// ============================================================================

export interface Step1Response {
  success: boolean
  item_id: string
  product: ProductData
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
}
