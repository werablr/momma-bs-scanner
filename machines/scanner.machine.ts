/**
 * Scanner State Machine
 *
 * Based on SCANNER_STATE_MACHINE_DESIGN_V3.1.md
 * Phase 1: Barcode workflow only
 *
 * This machine manages the complete barcode scanning workflow:
 * 1. Camera permissions
 * 2. Barcode detection
 * 3. Location selection
 * 4. API call (Step 1 - create pending item)
 * 5. Expiration capture (optional)
 * 6. Update expiration (Step 2)
 * 7. Review
 * 8. Finalize (mark as active)
 */

import { setup, assign, fromPromise } from 'xstate'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Camera } from 'react-native-vision-camera'
import { Linking } from 'react-native'
import { supabase } from '../lib/supabase'
import {
  ScannerContext,
  ScannerEvent,
  initialScannerContext,
  CameraPermissionResponse,
  PersistedScanData,
  Step1Response,
  Step2Response,
  InventoryItem,
} from '../types/scanner.types'

// ============================================================================
// Type-safe Machine Setup
// ============================================================================

export const scannerMachine = setup({
  types: {
    context: {} as ScannerContext,
    events: {} as ScannerEvent,
  },

  // ==========================================================================
  // Guards (Validation for Transitions)
  // ==========================================================================
  // Note: Guards for invoke completions are defined inline in onDone transitions (XState v5 pattern)
  guards: {
    // Input validation (user-triggered events)
    isValidBarcode: ({ event }) => {
      if (event.type !== 'BARCODE_DETECTED') return false
      return event.barcode && event.barcode.length >= 8
    },

    isValidPLU: ({ event }) => {
      if (event.type !== 'PLU_ENTERED') return false
      return event.plu_code && /^\d{4,5}$/.test(event.plu_code)
    },

    // Context validation
    hasStorageLocation: ({ context }) => {
      return context.storage_location_id !== null
    },

    hasScanId: ({ context }) => {
      return context.scan_id !== null
    },

    hasProduct: ({ context }) => {
      return context.product !== null
    },

    hasMatches: ({ context }) => {
      return context.matches !== null && context.matches.length > 0
    },

    // Workflow type guards
    isBarcodeWorkflow: ({ context }) => {
      return context.mode === 'barcode'
    },

    isPLUWorkflow: ({ context }) => {
      return context.mode === 'plu'
    },

    isPhotoWorkflow: ({ context }) => {
      return context.mode === 'photo'
    },
  },

  // ==========================================================================
  // Actions (Side Effects and Context Updates)
  // ==========================================================================
  actions: {
    // Mode setting
    setMode: assign({
      mode: (_, params: { mode: ScannerContext['mode'] }) => params.mode,
    }),

    // Store barcode data
    storeBarcode: assign({
      barcode: ({ event }) => {
        if (event.type !== 'BARCODE_DETECTED') return null
        return event.barcode
      },
      barcodeType: ({ event }) => {
        if (event.type !== 'BARCODE_DETECTED') return null
        return event.barcodeType
      },
    }),

    // Store PLU code
    storePLU: assign({
      plu_code: ({ event }) => {
        if (event.type !== 'PLU_ENTERED') return null
        return event.plu_code
      },
    }),

    // Store photo data
    storePhotoData: assign({
      photo_base64: ({ event }) => {
        if (event.type !== 'PHOTO_CAPTURED') return null
        return event.photo_base64
      },
    }),

    // Store PLU code from photo AI identification
    storePLUFromPhoto: assign({
      plu_code: ({ event }) => {
        if (!('output' in event) || !event.output) return null
        const output = event.output as any
        return output.plu_code || null
      },
    }),

    // Store location and generate idempotency key
    storeLocation: assign({
      storage_location_id: ({ event }) => {
        if (event.type !== 'LOCATION_SELECTED') return null
        return event.location_id
      },
      idempotency_key: () => {
        // Generate UUID for idempotency (React Native compatible)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      },
    }),

    // Store product from API (used in onDone transition - event.output is typed)
    storeProduct: assign({
      product: ({ event }) => {
        // In onDone context, event is DoneActorEvent with typed output
        if (!('output' in event) || !event.output) return null
        const output = event.output as Step1Response
        return output.product
      },
    }),

    // Store scan ID from API (used in onDone transition - event.output is typed)
    storeScanId: assign({
      scan_id: ({ event }) => {
        // In onDone context, event is DoneActorEvent with typed output
        if (!('output' in event) || !event.output) return null
        const output = event.output as Step1Response
        return output.item_id
      },
    }),

    // Store expiration data
    storeExpiration: assign({
      expiration_date: ({ event }) => {
        if (event.type !== 'EXPIRATION_CAPTURED') return null
        return event.date
      },
      ocr_text: ({ event }) => {
        if (event.type !== 'EXPIRATION_CAPTURED') return null
        return event.ocr_text
      },
      ocr_confidence: ({ event }) => {
        if (event.type !== 'EXPIRATION_CAPTURED') return null
        return event.confidence
      },
    }),

    // Store matches from PLU/Photo lookup (used in onDone transitions)
    storeMatches: assign({
      matches: ({ event }) => {
        if (!('output' in event) || !event.output) return null
        const output = event.output as any
        return output.matches || null
      },
    }),

    // Store quantity from match selection
    storeQuantity: assign({
      quantity: ({ event }) => {
        if (event.type !== 'MATCH_SELECTED') return 1
        return event.quantity || 1
      },
    }),

    // Store product from match selection (overrides storeProduct for PLU/Photo)
    storeProductFromMatch: assign({
      product: ({ event }) => {
        if (event.type !== 'MATCH_SELECTED') return null
        return event.match
      },
    }),

    // Auto-select single match (used when PLU lookup returns exactly one result)
    autoSelectSingleMatch: assign({
      product: ({ event }) => {
        if (!('output' in event) || !event.output) return null
        const output = event.output as any
        if (output.matches && output.matches.length === 1) {
          return output.matches[0]
        }
        return null
      },
      quantity: ({ event }) => {
        // Default quantity to 1 for auto-selected PLU items
        if (!('output' in event) || !event.output) return 1
        const output = event.output as any
        if (output.matches && output.matches.length === 1) {
          return 1
        }
        return 1
      },
    }),

    // Generate pseudo-barcode for PLU/Photo workflows
    generatePseudoBarcode: assign({
      barcode: ({ context }) => {
        if (context.mode === 'plu') {
          return `PLU-${context.plu_code}-${Date.now()}`
        } else if (context.mode === 'photo') {
          return `PHOTO-${Date.now()}`
        }
        return context.barcode
      },
    }),

    // Store flag reason
    storeFlagReason: assign({
      flag_reason: ({ event }) => {
        if (event.type !== 'REVIEW_FLAGGED') return null
        return event.reason
      },
      flag_notes: ({ event }) => {
        if (event.type !== 'REVIEW_FLAGGED') return null
        return event.notes
      },
    }),

    // Store completed item (used in onDone transition)
    storeCompletedItem: assign({
      completed_item: ({ event }) => {
        // In onDone context, this is already properly typed
        if (!('output' in event)) return null
        return event.output as InventoryItem
      },
    }),

    // Store error (used in onError transitions)
    storeError: assign({
      error: ({ event }) => {
        // In onError transitions, event has .error property (XState internal event type)
        const err = (event as any).error
        return {
          message: err?.message || 'Unknown error',
          code: err?.code || null,
          type: classifyError(err?.message || ''),
          retryable: true,
        }
      },
    }),

    // Set retry state
    setRetryState: assign({
      retry_state: (_, params: { state: string }) => params.state,
    }),

    // Reset context to initial state
    resetContext: assign(() => initialScannerContext),

    // Restore context from crash recovery (used in onDone transition)
    restoreContext: assign(({ event }) => {
      if (!('output' in event) || !event.output) return initialScannerContext
      const data = event.output as PersistedScanData
      return { ...initialScannerContext, ...data.context }
    }),

    // Persist state for crash recovery
    persistState: ({ context, self }) => {
      const state = self.getSnapshot()
      AsyncStorage.setItem(
        'pendingScan',
        JSON.stringify({
          state: state.value,
          context: context,
        })
      )
    },

    // Open iOS settings
    openIOSSettings: () => {
      Linking.openSettings()
    },
  },

  // ==========================================================================
  // Actors (Async Services)
  // ==========================================================================
  actors: {
    // Camera permissions
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => {
      const permission = await Camera.getCameraPermissionStatus()
      return { hasPermission: permission === 'granted' }
    }),

    requestCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => {
      const permission = await Camera.requestCameraPermission()
      return { hasPermission: permission === 'granted' }
    }),

    // Crash recovery
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => {
      const data = await AsyncStorage.getItem('pendingScan')
      return data ? JSON.parse(data) : { scan_id: null }
    }),

    clearPendingScan: fromPromise(async (): Promise<void> => {
      console.log('[clearPendingScan] Removing persisted scan from AsyncStorage...')
      await AsyncStorage.removeItem('pendingScan')
      console.log('[clearPendingScan] ✅ Persisted scan cleared')
    }),

    // Barcode workflow - Step 1 (create pending item)
    callStep1: fromPromise(async ({ input }): Promise<Step1Response> => {
      const { context } = input as { context: ScannerContext }

      console.log('[callStep1] Starting Step 1 API call...')
      console.log('[callStep1] Barcode:', context.barcode)
      console.log('[callStep1] Storage location:', context.storage_location_id)
      console.log('[callStep1] Idempotency key:', context.idempotency_key)

      const { data, error } = await supabase.functions.invoke('scanner-ingest', {
        body: {
          workflow: 'two-step',
          step: 1,
          barcode: context.barcode,
          storage_location_id: context.storage_location_id,
          idempotency_key: context.idempotency_key,
        },
      })

      if (error) {
        console.error('[callStep1] ❌ Error from edge function:', error)
        throw error
      }

      if (!data) {
        console.error('[callStep1] ❌ No data returned from scanner-ingest')
        throw new Error('No data returned from scanner-ingest')
      }

      console.log('[callStep1] ✅ Step 1 success:', data)
      return data as Step1Response
    }),

    // Barcode workflow - Step 2 (update expiration)
    callStep2: fromPromise(async ({ input }): Promise<Step2Response> => {
      const { context } = input as { context: ScannerContext }

      console.log('[callStep2] Starting Step 2 API call...')
      console.log('[callStep2] scan_id:', context.scan_id)
      console.log('[callStep2] expiration_date:', context.expiration_date)

      // Handle expiration_date which could be Date, string, or null/undefined
      let extractedDate = null
      if (context.expiration_date) {
        if (context.expiration_date instanceof Date) {
          extractedDate = context.expiration_date.toISOString()
        } else if (typeof context.expiration_date === 'string') {
          extractedDate = context.expiration_date
        }
      }

      console.log('[callStep2] extracted_date (ISO):', extractedDate)

      const { data, error } = await supabase.functions.invoke('scanner-ingest', {
        body: {
          workflow: 'two-step',
          step: 2,
          scan_id: context.scan_id,
          extracted_date: extractedDate,
          ocr_text: context.ocr_text,
          confidence: context.ocr_confidence,
        },
      })

      if (error) {
        console.error('[callStep2] ❌ Error from edge function:', error)
        throw error
      }

      if (!data) {
        console.error('[callStep2] ❌ No data returned from Step 2')
        throw new Error('No data returned from scanner-ingest Step 2')
      }

      console.log('[callStep2] ✅ Step 2 success:', data)
      return data as Step2Response
    }),

    // PLU workflow - Lookup PLU code
    lookupPLU: fromPromise(async ({ input }) => {
      const { context } = input as { context: ScannerContext }

      console.log('[lookupPLU] Looking up PLU code:', context.plu_code)

      const { data, error } = await supabase.functions.invoke('lookup-plu', {
        body: { pluCode: context.plu_code },
      })

      if (error) {
        console.error('[lookupPLU] ❌ Error from edge function:', error)
        throw error
      }

      if (!data) {
        console.error('[lookupPLU] ❌ No data returned from lookup-plu')
        throw new Error('No data returned from lookup-plu')
      }

      console.log('[lookupPLU] ✅ PLU lookup success:', data)
      return data
    }),

    // Photo workflow - Identify PLU from photo
    identifyByPhoto: fromPromise(async ({ input }) => {
      const { context } = input as { context: ScannerContext }

      console.log('[identifyByPhoto] Identifying PLU from photo...')

      const { data, error } = await supabase.functions.invoke('identify-photo', {
        body: { photo_base64: context.photo_base64 },
      })

      if (error) {
        console.error('[identifyByPhoto] ❌ Error from edge function:', error)
        throw error
      }

      if (!data || !data.success) {
        console.error('[identifyByPhoto] ❌ No data returned from identify-photo')
        throw new Error('No data returned from identify-photo')
      }

      console.log('[identifyByPhoto] ✅ AI identified PLU code:', data.plu_code)

      // Return PLU code to be stored in context
      return {
        plu_code: data.plu_code,
        confidence: data.confidence,
        reasoning: data.reasoning,
      }
    }),

    // PLU workflow - Create inventory item directly (no barcode API needed)
    createPLUItem: fromPromise(async ({ input }) => {
      const { context } = input as { context: ScannerContext }

      console.log('[createPLUItem] Creating PLU inventory item...')
      console.log('[createPLUItem] Product:', JSON.stringify(context.product, null, 2))
      console.log('[createPLUItem] PLU Code:', context.plu_code)
      console.log('[createPLUItem] Barcode:', context.barcode)
      console.log('[createPLUItem] Storage location:', context.storage_location_id)

      // Extract product data from match (USDA format)
      const product = context.product as any // Match type from PLU lookup
      const nutrition = product?.nutrition

      console.log('[createPLUItem] Extracted nutrition:', JSON.stringify(nutrition, null, 2))
      console.log('[createPLUItem] FDC ID:', product?.fdc_id)

      // Get household_id from user_households table
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      console.log('[createPLUItem] Authenticated user:', user.id)

      // Query user_households to get the correct household_id
      const { data: userHouseholdData, error: householdError } = await supabase
        .from('user_households')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (householdError || !userHouseholdData) {
        console.error('[createPLUItem] ❌ Failed to get household_id:', householdError)
        throw new Error('Failed to get user household')
      }

      const household_id = userHouseholdData.household_id
      console.log('[createPLUItem] Using household_id:', household_id)

      // Create inventory item directly using ONLY actual schema columns
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          household_id,
          barcode: context.barcode, // PLU-{code}-{timestamp} or PHOTO-{timestamp}
          plu_code: context.plu_code, // Store the PLU code
          storage_location_id: context.storage_location_id,
          food_name: product?.product_name || product?.description || 'Unknown PLU Item',
          brand_name: product?.brands || null,
          quantity: context.quantity || 1,
          status: 'pending', // Will be set to active after review

          // USDA nutrition data (actual column names from schema)
          usda_calories: nutrition?.energy_kcal || null,
          usda_protein: nutrition?.proteins || null,
          usda_total_fat: nutrition?.fat || null,
          usda_saturated_fat: nutrition?.saturated_fat || null,
          usda_trans_fat: nutrition?.trans_fat || null,
          usda_total_carbohydrate: nutrition?.carbohydrates || null,
          usda_dietary_fiber: nutrition?.fiber || null,
          usda_sugars: nutrition?.sugars || null,
          usda_added_sugars: nutrition?.added_sugars || null,
          usda_cholesterol: nutrition?.cholesterol || null,
          usda_sodium: nutrition?.sodium || null,
          usda_potassium: nutrition?.potassium || null,
          usda_calcium: nutrition?.calcium || null,
          usda_iron: nutrition?.iron || null,
          usda_vitamin_d: nutrition?.vitamin_d || null,

          // USDA metadata (actual column name from schema)
          usda_fdc_id: product?.fdc_id || null,

          // Serving info
          serving_unit: nutrition?.serving_unit || null,

          // Data sources tracking
          data_sources: {
            usda: nutrition ? true : false, // USDA nutrition data present
            plu: true, // Always true for PLU/Photo workflow
          },

          // Timestamps (schema has these)
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          scanned_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('[createPLUItem] ❌ Error creating item:', error)
        throw error
      }

      console.log('[createPLUItem] ✅ PLU item created:', data)
      return { item_id: data.id, success: true }
    }),

    // Review actions
    updateStatus: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      const { error } = await supabase
        .from('inventory_items')
        .update({ status: 'active' })
        .eq('id', context.scan_id)

      if (error) throw error
    }),

    flagItemForReview: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      const { error } = await supabase
        .from('inventory_items')
        .update({
          flagged_for_review: true,
          flag_reason: context.flag_reason,
          flag_notes: context.flag_notes,
          status: 'active',
        })
        .eq('id', context.scan_id)

      if (error) throw error
    }),

    // Cleanup
    deletePendingItem: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      if (!context.scan_id) {
        console.log('[deletePendingItem] No scan_id, skipping delete')
        return
      }

      console.log(`[deletePendingItem] Deleting pending item: ${context.scan_id}`)
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', context.scan_id)
        .eq('status', 'pending')

      if (error) {
        console.error('[deletePendingItem] ❌ Delete failed:', error)
        throw error
      }
      console.log('[deletePendingItem] ✅ Pending item deleted')
    }),
  },
}).createMachine({
  /** @xstate-layout N8IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgGUwA7MAF0xIC9CBiHgNoAMAuoqAA4B7WMXx0sqPiAAeiAKwBGABwBmMQDYxADj0BOfQBoQATwFjZATn0BGMbP0AWAOwB2Mdb0XZgX36uU6LHiEJJQ0dIxMrGxcPOyCSCBiigraegCcihqiYvIaYuJiFhYOzo7u7p46YgDMRpoayqJWFspiNjZ+AcFo2HhEpBRUtPRNsWwAagAyABIAMgCiAJL9AL69AEIAkj0AogDKq-1z65vbcju9AJqHR1sAPpu3O4cAvmdBV4RXEGj3j88JHRQHBXVZLNY0WFLZbqADCh2OMTOgJud3uD2er3eXx+KGKZXK32qQKh6WqunqdQw+VEqKaGNRDQAsijiXinli3jd3o9ni9fG8Pu8yhUMF9igD-rVAf92Wzak0GaCNm1OgiuvD1vDNuFtucEZKnrjcQ8iU8Xv4Pv4laSQX81ay2hpmuINKJ+mJgeIxBZpJMnS63UiPZ7vYtfXzBfjPqzSvzMPzZAyocVWkoLA5tCJNPHGoqVWrsZqohqdS89QbVeaTa9TSa6hanq92Wa+cCyhrbbK-iooQ0M6y2kVuULDNoQYqW8rdkijYg0b7-qS2+7W+0-I6KS7h+2hzW3TXPmII10eSJZD8WfVsw4tCDlC1KgZLKG-i1tEA */
  id: 'scanner',
  initial: 'checkingPermissions',
  context: initialScannerContext,

  states: {
    // ========================================================================
    // Camera Permission States
    // ========================================================================
    checkingPermissions: {
      invoke: {
        src: 'checkCameraPermission',
        onDone: [
          {
            target: 'ready',
            guard: ({ event }) => event.output.hasPermission,
          },
          {
            target: 'requestingPermission',
          },
        ],
      },
    },

    requestingPermission: {
      invoke: {
        src: 'requestCameraPermission',
        onDone: [
          {
            target: 'ready',
            guard: ({ event }) => event.output.hasPermission,
          },
          {
            target: 'permissionDenied',
            actions: {
              type: 'storeError',
              params: { message: 'Camera access denied' },
            },
          },
        ],
      },
    },

    permissionDenied: {
      on: {
        OPEN_SETTINGS: {
          actions: 'openIOSSettings',
        },
        CANCEL: 'ready',
      },
    },

    // ========================================================================
    // Ready State (with Crash Recovery)
    // ========================================================================
    ready: {
      initial: 'checkingForInterrupted',

      states: {
        checkingForInterrupted: {
          invoke: {
            src: 'loadPersisted',
            onDone: [
              {
                target: 'interrupted',
                guard: ({ event }) => event.output.scan_id !== null,
                actions: 'restoreContext',
              },
              {
                target: 'idle',
              },
            ],
          },
        },

        interrupted: {
          on: {
            RESUME: {
              target: '#scanner.processing.reviewing',
              guard: 'hasScanId',
            },
            DISCARD: {
              target: '#scanner.processing.cleaningUp',
            },
          },
        },

        idle: {
          entry: 'resetContext',
          on: {
            START_BARCODE_SCAN: {
              target: '#scanner.scanning.barcode',
              actions: { type: 'setMode', params: { mode: 'barcode' } },
            },
            START_PLU_ENTRY: {
              target: '#scanner.scanning.plu',
              actions: { type: 'setMode', params: { mode: 'plu' } },
            },
            START_PHOTO_SCAN: {
              target: '#scanner.scanning.photo',
              actions: { type: 'setMode', params: { mode: 'photo' } },
            },
            // Phase 3+: Add other workflow entry points
            // START_MANUAL_ENTRY: ...
          },
        },
      },
    },

    // ========================================================================
    // Scanning State (Barcode Only in Phase 1)
    // ========================================================================
    scanning: {
      initial: 'barcode',
      states: {
        barcode: {
          on: {
            BARCODE_DETECTED: {
              target: '#scanner.processing.selectingLocation',
              guard: 'isValidBarcode',
              actions: 'storeBarcode',
            },
            CANCEL: '#scanner.ready.idle',
          },
        },

        plu: {
          on: {
            PLU_ENTERED: {
              target: '#scanner.processing.lookingUpPLU',
              guard: 'isValidPLU',
              actions: 'storePLU',
            },
            CANCEL: '#scanner.ready.idle',
          },
        },

        photo: {
          on: {
            PHOTO_CAPTURED: {
              target: '#scanner.processing.identifyingWithAI',
              actions: 'storePhotoData',
            },
            CANCEL: '#scanner.ready.idle',
          },
        },

        // Phase 3+: Add other scanning modes
        // manual: ...
      },
    },

    // ========================================================================
    // Processing State (Barcode Workflow)
    // ========================================================================
    processing: {
      initial: 'selectingLocation',
      entry: 'persistState',

      states: {
        // PLU workflow - Lookup PLU code
        lookingUpPLU: {
          invoke: {
            src: 'lookupPLU',
            input: ({ context }) => ({ context }),
            onDone: [
              {
                // Single match - auto-select and skip selection screen
                target: 'selectingLocation',
                guard: ({ event }) => {
                  const output = event.output as any
                  return output && output.matches && output.matches.length === 1
                },
                actions: ['autoSelectSingleMatch', 'generatePseudoBarcode'],
              },
              {
                // Multiple matches - show selection screen
                target: 'selectingMatch',
                guard: ({ event }) => {
                  const output = event.output as any
                  return output && output.matches && output.matches.length > 1
                },
                actions: 'storeMatches',
              },
              {
                // No matches - error
                target: '#scanner.error.noMatches',
                guard: ({ event }) => {
                  const output = event.output as any
                  return !output || !output.matches || output.matches.length === 0
                },
                actions: 'storeError',
              },
            ],
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'scanning.plu' } },
              ],
            },
          },
        },

        // Photo workflow - Identify PLU from photo, then lookup
        identifyingWithAI: {
          invoke: {
            src: 'identifyByPhoto',
            input: ({ context }) => ({ context }),
            onDone: {
              target: 'lookingUpPLU',
              actions: 'storePLUFromPhoto',
            },
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'scanning.photo' } },
              ],
            },
          },
        },

        // PLU/Photo workflow - Select match from list
        selectingMatch: {
          on: {
            MATCH_SELECTED: {
              target: 'selectingLocation',
              actions: ['storeProductFromMatch', 'storeQuantity', 'generatePseudoBarcode'],
            },
            CANCEL: '#scanner.ready.idle',
          },
        },

        selectingLocation: {
          on: {
            LOCATION_SELECTED: [
              {
                target: 'callingBarcodeAPI',
                guard: 'isBarcodeWorkflow',
                actions: 'storeLocation',
              },
              {
                target: 'creatingPLUItem',
                guard: 'isPLUWorkflow',
                actions: 'storeLocation',
              },
              {
                target: 'creatingPLUItem',
                guard: 'isPhotoWorkflow',
                actions: 'storeLocation',
              },
            ],
            CANCEL: '#scanner.ready.idle',
          },
        },

        // PLU workflow - Create inventory item directly
        creatingPLUItem: {
          invoke: {
            src: 'createPLUItem',
            input: ({ context }) => ({ context }),
            onDone: {
              target: 'capturingExpiration',
              actions: 'storeScanId',
            },
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'processing.selectingLocation' } },
              ],
            },
          },
        },

        callingBarcodeAPI: {
          invoke: {
            src: 'callStep1',
            input: ({ context }) => ({ context }),
            onDone: [
              {
                target: 'capturingExpiration',
                guard: ({ event }) =>
                  event.output && event.output.product !== null && event.output.product !== undefined,
                actions: ['storeProduct', 'storeScanId'],
              },
              {
                target: '#scanner.error.noMatches',
                guard: ({ event }) => !event.output || !event.output.product,
                actions: 'storeError',
              },
            ],
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'processing.selectingLocation' } },
              ],
            },
          },
        },

        capturingExpiration: {
          on: {
            EXPIRATION_CAPTURED: {
              target: 'updatingExpiration',
              actions: 'storeExpiration',
            },
            EXPIRATION_SKIPPED: 'reviewing',
            CANCEL: 'cleaningUp',
          },
        },

        updatingExpiration: {
          invoke: {
            src: 'callStep2',
            input: ({ context }) => ({ context }),
            onDone: 'reviewing',
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'processing.capturingExpiration' } },
              ],
            },
          },
        },

        reviewing: {
          on: {
            REVIEW_APPROVED: {
              target: 'finalizing',
              guard: 'hasScanId',
            },
            REVIEW_FLAGGED: {
              target: 'flagging',
              guard: 'hasScanId',
              actions: 'storeFlagReason',
            },
            CANCEL: 'cleaningUp',
          },
        },

        flagging: {
          invoke: {
            src: 'flagItemForReview',
            input: ({ context }) => ({ context }),
            onDone: 'finalizing',
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'processing.reviewing' } },
              ],
            },
          },
        },

        finalizing: {
          invoke: {
            src: 'updateStatus',
            input: ({ context }) => ({ context }),
            onDone: {
              target: '#scanner.complete',
              actions: 'storeCompletedItem',
            },
            onError: {
              target: '#scanner.error.retryable',
              actions: [
                'storeError',
                { type: 'setRetryState', params: { state: 'processing.reviewing' } },
              ],
            },
          },
        },

        cleaningUp: {
          invoke: {
            src: 'deletePendingItem',
            input: ({ context }) => ({ context }),
            onDone: {
              target: 'clearingPersistedState',
            },
            onError: {
              // Even if delete fails, still clear AsyncStorage
              target: 'clearingPersistedState',
            },
          },
        },

        clearingPersistedState: {
          invoke: {
            src: 'clearPendingScan',
            onDone: {
              target: '#scanner.ready.idle',
              actions: 'resetContext',
            },
            onError: {
              target: '#scanner.ready.idle',
              actions: 'resetContext',
            },
          },
        },
      },
    },

    // ========================================================================
    // Error States
    // ========================================================================
    error: {
      initial: 'retryable',
      states: {
        retryable: {
          on: {
            RETRY: [
              // PLU workflow retry states
              {
                target: '#scanner.scanning.plu',
                guard: ({ context }) => context.retry_state === 'scanning.plu',
              },
              // Barcode workflow retry states
              {
                target: '#scanner.processing.capturingExpiration',
                guard: ({ context }) => context.retry_state === 'processing.capturingExpiration',
              },
              {
                target: '#scanner.processing.reviewing',
                guard: ({ context }) => context.retry_state === 'processing.reviewing',
              },
              // Fallback to location selection (barcode workflow default)
              {
                target: '#scanner.processing.selectingLocation',
              },
              // Phase 3+: Add these when implemented
              // - processing.uploadingPhoto
              // - processing.callingPhotoAPI
              // - processing.identifyingWithAI
              // - scanning.manual
            ],
            CANCEL: '#scanner.ready.idle',
          },
        },

        noMatches: {
          on: {
            MANUAL_ENTRY_FALLBACK: {
              target: '#scanner.ready.idle', // Phase 2: target manual entry
              actions: { type: 'setMode', params: { mode: 'manual' } },
            },
            RETRY: '#scanner.scanning.barcode',
            CANCEL: '#scanner.ready.idle',
          },
        },

        fatal: {
          on: {
            CANCEL: '#scanner.ready.idle',
          },
        },
      },
    },

    // ========================================================================
    // Complete State
    // ========================================================================
    complete: {
      invoke: {
        src: 'clearPendingScan',
      },
      on: {
        SCAN_ANOTHER: '#scanner.ready.idle',
        CANCEL: '#scanner.ready.idle',
      },
    },
  },
})

// ============================================================================
// Helper Functions
// ============================================================================

function classifyError(message: string): 'network' | 'timeout' | 'auth' | 'server' | 'unknown' {
  if (message.includes('network') || message.includes('offline')) return 'network'
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('401') || message.includes('403')) return 'auth'
  if (message.includes('500')) return 'server'
  return 'unknown'
}
