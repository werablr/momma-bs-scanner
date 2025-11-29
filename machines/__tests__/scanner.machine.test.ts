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
})
