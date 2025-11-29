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

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMachine } from '@xstate/react';
import { scannerMachine } from '../machines/scanner.machine';
import { StorageLocation, InventoryItem } from '../types/scanner.types';

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
  // ==========================================================================
  // STATE MACHINE - Single source of truth
  // ==========================================================================
  const [state, send] = useMachine(scannerMachine);

  // ==========================================================================
  // DERIVED UI STATE - No useState for workflow
  // ==========================================================================
  const ui = useMemo(
    () => ({
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

      onLocationSelected: (locationId: string) => {
        send({ type: 'LOCATION_SELECTED', location_id: locationId });
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

      {/* Placeholder for actual UI components */}
      <View style={styles.content}>
        <Text style={styles.title}>BarcodeScannerV2 (Skeleton)</Text>
        <Text style={styles.subtitle}>Phase 2 - Step 1: Skeleton</Text>

        {ui.showPermissionRequest && (
          <Text style={styles.stateIndicator}>🔐 Requesting Permission...</Text>
        )}

        {ui.showPermissionDenied && (
          <Text style={styles.stateIndicator}>❌ Permission Denied</Text>
        )}

        {ui.showCamera && (
          <Text style={styles.stateIndicator}>📷 Camera Active (TODO)</Text>
        )}

        {ui.showLocationPicker && (
          <Text style={styles.stateIndicator}>📍 Location Picker (TODO)</Text>
        )}

        {ui.showExpirationCapture && (
          <Text style={styles.stateIndicator}>📅 Expiration Capture (TODO)</Text>
        )}

        {ui.showReview && (
          <Text style={styles.stateIndicator}>👀 Review (TODO)</Text>
        )}

        {ui.showError && (
          <Text style={styles.stateIndicator}>⚠️ Error State (TODO)</Text>
        )}

        {ui.showSuccess && (
          <Text style={styles.stateIndicator}>✅ Success! (TODO)</Text>
        )}

        {ui.isLoading && (
          <Text style={styles.stateIndicator}>⏳ Loading...</Text>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Styles
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
  },
  stateIndicator: {
    fontSize: 18,
    color: '#4CAF50',
    marginVertical: 4,
  },
});
