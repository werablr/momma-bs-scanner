/**
 * BarcodeScannerV2 - Phase 2 Implementation
 *
 * State Machine Integration:
 * - Zero useState hooks for workflow state
 * - All UI derived from state.matches()
 * - Single source of truth (XState machine)
 *
 * Based on SCANNER_STATE_MACHINE_DESIGN_V3.1.md
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMachine } from '@xstate/react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useCodeScanner } from 'react-native-vision-camera';
import { scannerMachine } from '../machines/scanner.machine';
import { StorageLocation, InventoryItem } from '../types/scanner.types';
import StorageLocationPicker from './StorageLocationPicker';
import ExpirationDateCapture from './ExpirationDateCapture';
import EditableReview from './EditableReview';

// ============================================================================
// Component Props
// ============================================================================

interface BarcodeScannerV2Props {
  storageLocations: StorageLocation[];  // From app level (V3.1 Gap 1.2)
  onProductScanned?: (item: InventoryItem) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function BarcodeScannerV2({
  storageLocations,
  onProductScanned,
}: BarcodeScannerV2Props) {
  // Debug: Log what locations prop we receive
  console.log('[BarcodeScannerV2] storageLocations prop:', storageLocations);
  console.log('[BarcodeScannerV2] storageLocations count:', storageLocations?.length);

  // ==========================================================================
  // STATE MACHINE - Single source of truth
  // ==========================================================================
  const [state, send] = useMachine(scannerMachine);

  // ==========================================================================
  // CAMERA SETUP - Reused from BarcodeScanner.js
  // ==========================================================================
  const device = useCameraDevice('back');
  const scanCooldown = useRef(false);

  // Code scanner configuration (from BarcodeScanner.js lines 67-83)
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39'],
    onCodeScanned: (codes) => {
      if (scanCooldown.current || codes.length === 0) return;

      // Only process scans when in scanning.barcode state
      if (!state.matches({ scanning: 'barcode' })) return;

      // Block additional scans for 800ms while camera focuses
      scanCooldown.current = true;
      const code = codes[0];

      // Wait 800ms to allow camera autofocus to stabilize
      setTimeout(() => {
        scanCooldown.current = false;
        send({ type: 'BARCODE_DETECTED', barcode: code.value, barcodeType: code.type });
      }, 800);
    },
  });

  // ==========================================================================
  // DERIVED UI STATE - No useState for workflow
  // ==========================================================================
  const ui = useMemo(
    () => ({
      // Home screen
      showHomeScreen: state.matches({ ready: 'idle' }),

      // Camera states
      showPermissionRequest: state.matches('requestingPermission'),
      showPermissionDenied: state.matches('permissionDenied'),

      // Scanning states
      showCamera: state.matches({ scanning: 'barcode' }),

      // Processing states
      showLocationPicker: state.matches({ processing: 'selectingLocation' }),
      showExpirationCapture: state.matches({ processing: 'capturingExpiration' }),
      showReview: state.matches({ processing: 'reviewing' }),
      isLoading:
        state.matches({ processing: 'callingBarcodeAPI' }) ||
        state.matches({ processing: 'updatingExpiration' }) ||
        state.matches({ processing: 'finalizing' }),

      // Error states
      showError: state.matches('error'),
      showRetry: state.matches({ error: 'retryable' }),
      showNoProduct: state.matches({ error: 'noMatches' }),

      // Complete state
      showSuccess: state.matches('complete'),

      // Crash recovery
      showRecoveryPrompt: state.matches({ ready: 'interrupted' }),
    }),
    [state]
  );

  // ==========================================================================
  // EVENT HANDLERS - Send events to machine
  // ==========================================================================
  const handlers = useMemo(
    () => ({
      onBarcodeScanned: (code: string, type: string) => {
        send({ type: 'BARCODE_DETECTED', barcode: code, barcodeType: type });
      },

      onLocationSelected: (location: any) => {
        // StorageLocationPicker passes the whole location object
        // Extract the ID (supports both UUID string and numeric ID)
        const locationId = typeof location === 'object' ? location.id : location;
        console.log('[onLocationSelected] Location:', location, '→ ID:', locationId);
        send({ type: 'LOCATION_SELECTED', location_id: String(locationId) });
      },

      onExpirationCaptured: (date: Date, ocrText: string, confidence: number) => {
        send({ type: 'EXPIRATION_CAPTURED', date, ocr_text: ocrText, confidence });
      },

      onExpirationSkipped: () => {
        send({ type: 'EXPIRATION_SKIPPED' });
      },

      onReviewApproved: () => {
        send({ type: 'REVIEW_APPROVED' });
      },

      onReviewFlagged: (reason: string, notes: string) => {
        send({ type: 'REVIEW_FLAGGED', reason, notes });
      },

      onCancel: () => {
        send({ type: 'CANCEL' });
      },

      onScanAnother: () => {
        send({ type: 'SCAN_ANOTHER' });
      },

      onRetry: () => {
        send({ type: 'RETRY' });
      },

      onResumeScan: () => {
        send({ type: 'RESUME' });
      },

      onDiscardScan: () => {
        send({ type: 'DISCARD' });
      },

      onOpenSettings: () => {
        send({ type: 'OPEN_SETTINGS' });
      },
    }),
    [send]
  );

  // ==========================================================================
  // RENDER - Conditional based on state.matches()
  // ==========================================================================

  return (
    <View style={styles.container}>
      {/* Debug info - remove in production */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          State: {JSON.stringify(state.value)}
        </Text>
        <Text style={styles.debugText}>
          Mode: {state.context.mode || 'null'}
        </Text>
        <Text style={styles.debugText}>
          Barcode: {state.context.barcode || 'null'}
        </Text>
      </View>

      {/* CRASH RECOVERY - ready.interrupted state */}
      {ui.showRecoveryPrompt && (
        <View style={styles.homeScreen}>
          <View style={styles.homeContent}>
            <Text style={styles.welcomeText}>⚠️ Incomplete Scan</Text>
            <Text style={styles.instructionText}>
              You have an incomplete scan from a previous session.
            </Text>
            {state.context.barcode && (
              <Text style={styles.recoveryDetails}>
                Barcode: {state.context.barcode}
              </Text>
            )}
            {state.context.product?.name && (
              <Text style={styles.recoveryDetails}>
                Product: {state.context.product.name}
              </Text>
            )}

            <TouchableOpacity
              style={styles.startScanButton}
              onPress={handlers.onResumeScan}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>▶️ Resume Scan</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startScanButton, styles.discardButton]}
              onPress={handlers.onDiscardScan}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>🗑️ Discard</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* HOME SCREEN - ready.idle state */}
      {ui.showHomeScreen && (
        <View style={styles.homeScreen}>
          <View style={styles.homeContent}>
            <Text style={styles.welcomeText}>Scanner Ready</Text>
            <Text style={styles.instructionText}>
              Tap the button below to start scanning barcodes
            </Text>

            <TouchableOpacity
              style={styles.startScanButton}
              onPress={() => send({ type: 'START_BARCODE_SCAN' })}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>📱 Scan Barcode</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* CAMERA VIEW - scanning.barcode state */}
      {ui.showCamera && (
        <>
          {device ? (
            <Camera
              style={styles.camera}
              device={device}
              isActive={true}
              codeScanner={codeScanner}
            >
              <View style={styles.scanFrame}>
                <View style={styles.scanFrameCorner} />
                <Text style={styles.scanInstruction}>Point camera at barcode</Text>
              </View>
            </Camera>
          ) : (
            <View style={styles.camera}>
              <Text style={styles.errorText}>Camera not available</Text>
            </View>
          )}

          {/* Cancel Button */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonBackground}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handlers.onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* PLACEHOLDER STATES */}
      {ui.showPermissionRequest && (
        <View style={styles.content}>
          <Text style={styles.stateIndicator}>🔐 Requesting Permission...</Text>
        </View>
      )}

      {ui.showPermissionDenied && (
        <View style={styles.content}>
          <Text style={styles.stateIndicator}>❌ Permission Denied</Text>
        </View>
      )}

      {/* STORAGE LOCATION PICKER - processing.selectingLocation */}
      <StorageLocationPicker
        visible={ui.showLocationPicker}
        onClose={handlers.onCancel}
        onSelect={handlers.onLocationSelected}
        suggestedCategory={state.context.product?.suggested_category}
        productName={state.context.product?.name}
        storageLocations={storageLocations}
      />

      {/* EXPIRATION DATE CAPTURE - processing.capturingExpiration */}
      <ExpirationDateCapture
        visible={ui.showExpirationCapture}
        onClose={handlers.onCancel}
        onDateCaptured={(date: Date, ocrText: string, confidence: number) => {
          handlers.onExpirationCaptured(date, ocrText, confidence);
        }}
        productName={state.context.product?.name}
        scanId={state.context.scan_id}
        workflowStep="step2"
      />

      {/* REVIEW SCREEN - processing.reviewing */}
      <EditableReview
        visible={ui.showReview}
        onClose={handlers.onCancel}
        onApprove={handlers.onReviewApproved}
        onFlag={handlers.onReviewFlagged}
        productData={state.context.product}
        selectedStorage={state.context.storage_location_id}
        storageLocations={storageLocations}
        loading={false}
      />

      {/* ERROR SCREEN - error.retryable / error.noMatches / error.fatal */}
      {ui.showError && (
        <View style={styles.homeScreen}>
          <View style={styles.homeContent}>
            <Text style={styles.errorTitle}>⚠️ Error</Text>

            {state.context.error && (
              <>
                <Text style={styles.errorMessage}>
                  {state.context.error.message}
                </Text>
                {state.context.error.code && (
                  <Text style={styles.errorCode}>
                    Code: {state.context.error.code}
                  </Text>
                )}
              </>
            )}

            {state.context.barcode && (
              <Text style={styles.errorDetails}>
                Barcode: {state.context.barcode}
              </Text>
            )}

            {ui.showRetry && (
              <TouchableOpacity
                style={styles.startScanButton}
                onPress={handlers.onRetry}
                activeOpacity={0.7}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.startScanButtonText}>🔄 Retry</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.startScanButton, styles.discardButton]}
              onPress={handlers.onCancel}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>✕ Cancel</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {ui.showSuccess && (
        <View style={styles.content}>
          <Text style={styles.stateIndicator}>✅ Success! (TODO)</Text>
        </View>
      )}

      {ui.isLoading && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>⏳ Loading...</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles (from BarcodeScanner.js)
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  debugInfo: {
    backgroundColor: '#2a2a2a',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  debugText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stateIndicator: {
    fontSize: 18,
    color: '#4CAF50',
    marginVertical: 4,
  },
  // Home screen (from BarcodeScanner.js lines 904-945)
  homeScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e1a',
  },
  homeContent: {
    alignItems: 'center',
    padding: 30,
    width: '100%',
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  startScanButton: {
    backgroundColor: '#34C759',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15,
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonInner: {
    alignItems: 'center',
  },
  startScanButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Camera view (from BarcodeScanner.js lines 946-986)
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  scanFrameCorner: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#34C759',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scanInstruction: {
    marginTop: 30,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  // Error screen styles
  errorTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 15,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  errorCode: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginVertical: 10,
  },
  // Button container (from BarcodeScanner.js lines 987-1015)
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  buttonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 10,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Crash recovery styles
  recoveryDetails: {
    fontSize: 14,
    color: '#ccc',
    marginVertical: 5,
    textAlign: 'center',
  },
  discardButton: {
    backgroundColor: '#FF3B30',
    marginTop: 15,
  },
  // Overlay (from BarcodeScanner.js lines 1043-1063)
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
});
