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

    // Workflow type guards
    isBarcodeWorkflow: ({ context }) => {
      return context.mode === 'barcode'
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

    // Store location
    storeLocation: assign({
      storage_location_id: ({ event }) => {
        if (event.type !== 'LOCATION_SELECTED') return null
        return event.location_id
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
      await AsyncStorage.removeItem('pendingScan')
    }),

    // Barcode workflow - Step 1 (create pending item)
    callStep1: fromPromise(async ({ input }): Promise<Step1Response> => {
      const { context } = input as { context: ScannerContext }

      // TODO: Replace with actual Supabase edge function call
      // This is a mock implementation for Phase 1
      throw new Error('callStep1 not implemented - add Supabase client')

      // Real implementation:
      // const { data, error } = await supabase.functions.invoke('scanner-ingest', {
      //   body: {
      //     workflow: 'two-step',
      //     step: 1,
      //     barcode: context.barcode,
      //     storage_location_id: context.storage_location_id,
      //   }
      // })
      // if (error) throw error
      // return data as Step1Response
    }),

    // Barcode workflow - Step 2 (update expiration)
    callStep2: fromPromise(async ({ input }): Promise<Step2Response> => {
      const { context } = input as { context: ScannerContext }

      // TODO: Replace with actual Supabase edge function call
      throw new Error('callStep2 not implemented - add Supabase client')

      // Real implementation:
      // const { data, error } = await supabase.functions.invoke('scanner-ingest', {
      //   body: {
      //     workflow: 'two-step',
      //     step: 2,
      //     scan_id: context.scan_id,
      //     extracted_date: context.expiration_date,
      //     ocr_text: context.ocr_text,
      //     confidence: context.ocr_confidence,
      //   }
      // })
      // if (error) throw error
      // return data as Step2Response
    }),

    // Review actions
    updateStatus: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      // TODO: Replace with actual Supabase call
      throw new Error('updateStatus not implemented - add Supabase client')

      // Real implementation:
      // const { error } = await supabase
      //   .from('inventory_items')
      //   .update({ status: 'active' })
      //   .eq('id', context.scan_id)
      // if (error) throw error
    }),

    flagItemForReview: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      // TODO: Replace with actual Supabase call
      throw new Error('flagItemForReview not implemented - add Supabase client')

      // Real implementation:
      // const { error } = await supabase
      //   .from('inventory_items')
      //   .update({
      //     flagged_for_review: true,
      //     flag_reason: context.flag_reason,
      //     flag_notes: context.flag_notes,
      //     status: 'active'
      //   })
      //   .eq('id', context.scan_id)
      // if (error) throw error
    }),

    // Cleanup
    deletePendingItem: fromPromise(async ({ input }): Promise<void> => {
      const { context } = input as { context: ScannerContext }

      if (!context.scan_id) return

      // TODO: Replace with actual Supabase call
      throw new Error('deletePendingItem not implemented - add Supabase client')

      // Real implementation:
      // await supabase
      //   .from('inventory_items')
      //   .delete()
      //   .eq('id', context.scan_id)
      //   .eq('status', 'pending')
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
              target: 'idle',
              actions: ['resetContext'],
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
            // Phase 2+: Add other workflow entry points
            // START_PHOTO_SCAN: ...
            // START_PLU_ENTRY: ...
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
        // Phase 2+: Add other scanning modes
        // photo: ...
        // plu: ...
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
        selectingLocation: {
          on: {
            LOCATION_SELECTED: {
              target: 'callingBarcodeAPI',
              guard: 'isBarcodeWorkflow',
              actions: 'storeLocation',
            },
            CANCEL: '#scanner.ready.idle',
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
              // Phase 1: Barcode workflow retry states only
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
              // Phase 2+: Add these when implemented
              // - processing.uploadingPhoto
              // - processing.callingPhotoAPI
              // - processing.identifyingWithAI
              // - scanning.plu
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
