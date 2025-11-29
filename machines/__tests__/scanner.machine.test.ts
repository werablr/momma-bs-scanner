/**
 * Scanner State Machine Unit Tests
 *
 * Tests all transitions from SCANNER_STATE_MACHINE_DESIGN_V3.1.md
 * Phase 1: Barcode workflow only
 */

import { createActor, waitFor, fromPromise } from 'xstate'
import { scannerMachine } from '../scanner.machine'
import type {
  CameraPermissionResponse,
  PersistedScanData,
  Step1Response,
  Step2Response,
} from '../../types/scanner.types'

// =============================================================================
// Test Helpers
// =============================================================================

async function waitForState(actor: any, stateValue: string) {
  return waitFor(actor, (state) => state.matches(stateValue), { timeout: 1000 })
}

// =============================================================================
// 1. Initial State Tests
// =============================================================================

describe('Scanner State Machine - Initial State', () => {
  it('should start in checkingPermissions state', () => {
    const actor = createActor(scannerMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('checkingPermissions')
    actor.stop()
  })

  it('should have initial context with all null values except quantity=1', () => {
    const actor = createActor(scannerMachine)
    actor.start()
    const context = actor.getSnapshot().context

    expect(context.mode).toBeNull()
    expect(context.barcode).toBeNull()
    expect(context.quantity).toBe(1)
    expect(context.scan_id).toBeNull()

    actor.stop()
  })
})

// =============================================================================
// 2. Permission Flow Tests
// =============================================================================

describe('Scanner State Machine - Camera Permissions', () => {
  it('should transition to ready if permission already granted', async () => {
    const actor = createActor(
      scannerMachine.provide({
        actors: {
          checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: true,
          })),
          loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
            scan_id: null,
          })),
        },
      })
    )

    actor.start()
    await waitForState(actor, 'ready')

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    actor.stop()
  })

  it('should request permission if not granted', async () => {
    const actor = createActor(
      scannerMachine.provide({
        actors: {
          checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: false,
          })),
          requestCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: true,
          })),
          loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
            scan_id: null,
          })),
        },
      })
    )

    actor.start()
    await waitForState(actor, 'ready')

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    actor.stop()
  })

  it('should go to permissionDenied if user denies permission', async () => {
    const actor = createActor(
      scannerMachine.provide({
        actors: {
          checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: false,
          })),
          requestCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: false,
          })),
        },
      })
    )

    actor.start()
    await waitForState(actor, 'permissionDenied')

    expect(actor.getSnapshot().value).toBe('permissionDenied')
    expect(actor.getSnapshot().context.error).toBeTruthy()
    actor.stop()
  })

  it('should allow manual entry from permissionDenied via CANCEL', async () => {
    const actor = createActor(
      scannerMachine.provide({
        actors: {
          checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: false,
          })),
          requestCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
            hasPermission: false,
          })),
          loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
            scan_id: null,
          })),
        },
      })
    )

    actor.start()
    await waitForState(actor, 'permissionDenied')

    actor.send({ type: 'CANCEL' })
    await waitForState(actor, 'ready')

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    actor.stop()
  })
})

// =============================================================================
// 3. Happy Path - Barcode Workflow
// =============================================================================

describe('Scanner State Machine - Barcode Happy Path', () => {
  const mockActors = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => ({
      success: true,
      item_id: 'test-scan-id',
      product: {
        product_name: 'Test Product',
        brands: 'Test Brand',
        barcode: '12345678',
      },
    })),
    callStep2: fromPromise(async (): Promise<Step2Response> => ({
      success: true,
    })),
    updateStatus: fromPromise(async (): Promise<void> => {
      // updateStatus returns void
    }),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should complete full barcode workflow: idle → scanning → complete', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    // Step 1: Start barcode scan
    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    expect(actor.getSnapshot().matches({ scanning: 'barcode' })).toBe(true)
    expect(actor.getSnapshot().context.mode).toBe('barcode')

    // Step 2: Detect barcode
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    expect(actor.getSnapshot().matches({ processing: 'selectingLocation' })).toBe(true)
    expect(actor.getSnapshot().context.barcode).toBe('12345678')

    // Step 3: Select location
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitForState(actor, 'processing')

    // Wait for API call to complete
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'capturingExpiration' }),
      { timeout: 2000 }
    )

    expect(actor.getSnapshot().context.storage_location_id).toBe('fridge')
    expect(actor.getSnapshot().context.scan_id).toBe('test-scan-id')

    // Step 4: Skip expiration
    actor.send({ type: 'EXPIRATION_SKIPPED' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 1000 }
    )

    // Step 5: Approve review
    actor.send({ type: 'REVIEW_APPROVED' })
    await waitFor(actor, (state) => state.matches('complete'), { timeout: 2000 })

    expect(actor.getSnapshot().value).toBe('complete')
    actor.stop()
  })

  it('should allow cancel during barcode scanning', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    // Start scanning
    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    expect(actor.getSnapshot().matches({ scanning: 'barcode' })).toBe(true)

    // User cancels
    actor.send({ type: 'CANCEL' })
    await waitForState(actor, 'ready')
    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    expect(actor.getSnapshot().context.mode).toBeNull()
    expect(actor.getSnapshot().context.barcode).toBeNull()

    actor.stop()
  })
})

// =============================================================================
// 4. Error Handling - Step 1 Failure
// =============================================================================

describe('Scanner State Machine - Step 1 API Failure', () => {
  const mockActorsWithStep1Failure = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => {
      throw new Error('Network timeout')
    }),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should transition to error.retryable state after Step 1 API failure', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActorsWithStep1Failure }))

    actor.start()
    await waitForState(actor, 'ready')

    // Scan barcode
    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')

    // Select location
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })

    // Wait for error.retryable state after Step 1 failure (V3.1 line 106)
    await waitFor(actor, (state) => state.matches({ error: 'retryable' }), { timeout: 2000 })

    expect(actor.getSnapshot().matches({ error: 'retryable' })).toBe(true)
    expect(actor.getSnapshot().context.error).toBeTruthy()
    actor.stop()
  })

  it('should allow user to retry from error.retryable state', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActorsWithStep1Failure }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitFor(actor, (state) => state.matches({ error: 'retryable' }), { timeout: 2000 })

    // User clicks RETRY event (V3.1 line 204) - should go back to selectingLocation
    actor.send({ type: 'RETRY' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'selectingLocation' }),
      { timeout: 1000 }
    )

    expect(actor.getSnapshot().matches({ processing: 'selectingLocation' })).toBe(true)
    actor.stop()
  })
})

// =============================================================================
// 5. Product Not Found Flow
// =============================================================================

describe('Scanner State Machine - Product Not Found', () => {
  const mockActorsNoProduct = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => ({
      success: true,
      item_id: 'no-product-id',
      product: null, // Product not found in APIs
    })),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should transition to error.noMatches state when APIs return no data', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActorsNoProduct }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '99999999', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'pantry' })

    // Should transition to error.noMatches after Step 1 returns null product (V3.1 line 107)
    await waitFor(actor, (state) => state.matches({ error: 'noMatches' }), { timeout: 2000 })

    expect(actor.getSnapshot().matches({ error: 'noMatches' })).toBe(true)
    // Phase 1: scan_id NOT stored when no product (V3.1 line 303 - only storeError action)
    expect(actor.getSnapshot().context.error).toBeTruthy()
    actor.stop()
  })

  it('should allow manual entry fallback from error.noMatches state', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActorsNoProduct }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '99999999', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'pantry' })
    await waitFor(actor, (state) => state.matches({ error: 'noMatches' }), { timeout: 2000 })

    // User sends MANUAL_ENTRY_FALLBACK event (V3.1 line 205)
    actor.send({ type: 'MANUAL_ENTRY_FALLBACK' })
    await waitFor(actor, (state) => state.matches({ ready: 'idle' }), { timeout: 1000 })

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    // Phase 1: transitions to ready.idle (scanning.manual doesn't exist until Phase 3)
    // The idle entry action resets context, so mode is null (not 'manual')
    expect(actor.getSnapshot().context.mode).toBeNull()
    actor.stop()
  })
})

// =============================================================================
// 6. Expiration Capture Tests
// =============================================================================

describe('Scanner State Machine - Expiration Capture', () => {
  const mockActors = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => ({
      success: true,
      item_id: 'test-scan-id',
      product: {
        product_name: 'Test Product',
        brands: 'Test Brand',
        barcode: '12345678',
      },
    })),
    callStep2: fromPromise(async (): Promise<Step2Response> => ({
      success: true,
    })),
    updateStatus: fromPromise(async (): Promise<void> => {}),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should accept manual expiration date entry', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'capturingExpiration' }),
      { timeout: 2000 }
    )

    // User enters expiration manually - EXPIRATION_CAPTURED event (V3.1 line 198)
    const expirationDate = new Date('2025-12-31')
    actor.send({
      type: 'EXPIRATION_CAPTURED',
      date: expirationDate,
      ocr_text: 'Manual entry',
      confidence: 1.0,
    })

    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 2000 }
    )

    expect(actor.getSnapshot().context.expiration_date).toEqual(expirationDate)
    actor.stop()
  })

  it('should accept OCR-detected expiration date', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'capturingExpiration' }),
      { timeout: 2000 }
    )

    // OCR detects expiration - EXPIRATION_CAPTURED event (V3.1 line 198)
    const ocrDate = new Date('2026-01-15')
    actor.send({
      type: 'EXPIRATION_CAPTURED',
      date: ocrDate,
      ocr_text: 'JAN 15 2026',
      confidence: 0.95,
    })

    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 2000 }
    )

    expect(actor.getSnapshot().context.expiration_date).toEqual(ocrDate)
    actor.stop()
  })
})

// =============================================================================
// 7. Review Flow Tests
// =============================================================================

describe('Scanner State Machine - Review Flow', () => {
  const mockActors = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => ({
      success: true,
      item_id: 'test-scan-id',
      product: {
        product_name: 'Test Product',
        brands: 'Test Brand',
        barcode: '12345678',
      },
    })),
    callStep2: fromPromise(async (): Promise<Step2Response> => ({
      success: true,
    })),
    updateStatus: fromPromise(async (): Promise<void> => {}),
    flagItemForReview: fromPromise(async (): Promise<void> => {}),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should allow user to reject review and flag item', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'capturingExpiration' }),
      { timeout: 2000 }
    )
    actor.send({ type: 'EXPIRATION_SKIPPED' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 2000 }
    )

    // User flags review (wrong product data) - REVIEW_FLAGGED event (V3.1 line 201)
    actor.send({
      type: 'REVIEW_FLAGGED',
      reason: 'Wrong product',
      notes: "Product name doesn't match",
    })

    await waitFor(actor, (state) => state.matches('complete'), { timeout: 2000 })

    // Item should be flagged for manual review in Pantry
    expect(actor.getSnapshot().value).toBe('complete')
    actor.stop()
  })
})

// =============================================================================
// 8. Crash Recovery Tests
// =============================================================================

describe('Scanner State Machine - Crash Recovery', () => {
  it('should recover pending scan on startup', async () => {
    const mockActorsWithPending = {
      checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
        hasPermission: true,
      })),
      loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
        scan_id: 'recovered-scan-id',
        context: {
          scan_id: 'recovered-scan-id',
          mode: 'barcode' as const,
          barcode: '12345678',
        },
      })),
      callStep2: fromPromise(async (): Promise<Step2Response> => ({
        success: true,
      })),
      updateStatus: fromPromise(async (): Promise<void> => {}),
      clearPendingScan: fromPromise(async (): Promise<void> => {}),
    }

    const actor = createActor(scannerMachine.provide({ actors: mockActorsWithPending }))

    actor.start()

    // Should detect pending scan and show ready.interrupted state (V3.1 line 69)
    await waitFor(actor, (state) => state.matches({ ready: 'interrupted' }), { timeout: 2000 })

    expect(actor.getSnapshot().matches({ ready: 'interrupted' })).toBe(true)
    expect(actor.getSnapshot().context.scan_id).toBe('recovered-scan-id')
    actor.stop()
  })

  it('should allow user to resume pending scan', async () => {
    const mockActorsWithPending = {
      checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
        hasPermission: true,
      })),
      loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
        scan_id: 'recovered-scan-id',
        context: {
          scan_id: 'recovered-scan-id',
          mode: 'barcode' as const,
          barcode: '12345678',
        },
      })),
      callStep2: fromPromise(async (): Promise<Step2Response> => ({
        success: true,
      })),
      updateStatus: fromPromise(async (): Promise<void> => {}),
      clearPendingScan: fromPromise(async (): Promise<void> => {}),
    }

    const actor = createActor(scannerMachine.provide({ actors: mockActorsWithPending }))

    actor.start()
    await waitFor(actor, (state) => state.matches({ ready: 'interrupted' }), { timeout: 2000 })

    // User sends RESUME event (V3.1 line 208) - transitions to processing.reviewing (V3.1 line 70)
    actor.send({ type: 'RESUME' })

    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 1000 }
    )

    expect(actor.getSnapshot().matches({ processing: 'reviewing' })).toBe(true)
    actor.stop()
  })

  it('should allow user to discard pending scan', async () => {
    const mockActorsWithPending = {
      checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
        hasPermission: true,
      })),
      loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
        scan_id: 'recovered-scan-id',
        context: {
          scan_id: 'recovered-scan-id',
          mode: 'barcode' as const,
          barcode: '12345678',
        },
      })),
      deletePendingItem: fromPromise(async (): Promise<void> => {}),
      clearPendingScan: fromPromise(async (): Promise<void> => {}),
    }

    const actor = createActor(scannerMachine.provide({ actors: mockActorsWithPending }))

    actor.start()
    await waitFor(actor, (state) => state.matches({ ready: 'interrupted' }), { timeout: 2000 })

    // User sends DISCARD event (V3.1 line 209) - transitions to ready.idle (V3.1 line 71)
    actor.send({ type: 'DISCARD' })

    await waitFor(actor, (state) => state.matches({ ready: 'idle' }), { timeout: 1000 })

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    expect(actor.getSnapshot().context.barcode).toBeNull()
    actor.stop()
  })
})

// =============================================================================
// 9. Complete Flow Restart Test
// =============================================================================

describe('Scanner State Machine - Complete Flow Restart', () => {
  const mockActors = {
    checkCameraPermission: fromPromise(async (): Promise<CameraPermissionResponse> => ({
      hasPermission: true,
    })),
    loadPersisted: fromPromise(async (): Promise<PersistedScanData> => ({
      scan_id: null,
    })),
    callStep1: fromPromise(async (): Promise<Step1Response> => ({
      success: true,
      item_id: 'test-scan-id',
      product: {
        product_name: 'Test Product',
        brands: 'Test Brand',
        barcode: '12345678',
      },
    })),
    callStep2: fromPromise(async (): Promise<Step2Response> => ({
      success: true,
    })),
    updateStatus: fromPromise(async (): Promise<void> => {}),
    clearPendingScan: fromPromise(async (): Promise<void> => {}),
  }

  it('should reset to idle after completing scan', async () => {
    const actor = createActor(scannerMachine.provide({ actors: mockActors }))

    actor.start()
    await waitForState(actor, 'ready')

    // Complete full scan
    actor.send({ type: 'START_BARCODE_SCAN' })
    await waitForState(actor, 'scanning')
    actor.send({ type: 'BARCODE_DETECTED', barcode: '12345678', barcodeType: 'EAN-13' })
    await waitForState(actor, 'processing')
    actor.send({ type: 'LOCATION_SELECTED', location_id: 'fridge' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'capturingExpiration' }),
      { timeout: 2000 }
    )
    actor.send({ type: 'EXPIRATION_SKIPPED' })
    await waitFor(
      actor,
      (state) => state.matches({ processing: 'reviewing' }),
      { timeout: 2000 }
    )
    actor.send({ type: 'REVIEW_APPROVED' })
    await waitFor(actor, (state) => state.matches('complete'), { timeout: 2000 })

    // User starts new scan - SCAN_ANOTHER event (V3.1 line 176, transition line 111)
    actor.send({ type: 'SCAN_ANOTHER' })
    await waitFor(actor, (state) => state.matches({ ready: 'idle' }), { timeout: 1000 })

    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true)
    expect(actor.getSnapshot().context.barcode).toBeNull()
    expect(actor.getSnapshot().context.scan_id).toBeNull()
    actor.stop()
  })
})
