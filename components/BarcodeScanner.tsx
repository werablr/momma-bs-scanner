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

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal } from 'react-native';
import { useMachine } from '@xstate/react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useCodeScanner } from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
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
      showPLUEntry: state.matches({ scanning: 'plu' }),
      showPhotoCapture: state.matches({ scanning: 'photo' }),

      // Processing states
      showMatchSelection: state.matches({ processing: 'selectingMatch' }),
      showLocationPicker: state.matches({ processing: 'selectingLocation' }),
      showExpirationCapture: state.matches({ processing: 'capturingExpiration' }),
      showReview: state.matches({ processing: 'reviewing' }),
      isLoading:
        state.matches({ processing: 'callingBarcodeAPI' }) ||
        state.matches({ processing: 'lookingUpPLU' }) ||
        state.matches({ processing: 'identifyingWithAI' }) ||
        state.matches({ processing: 'creatingPLUItem' }) ||
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

      onPLUEntered: (pluCode: string) => {
        send({ type: 'PLU_ENTERED', plu_code: pluCode });
      },

      onPhotoCaptured: (photoBase64: string) => {
        send({ type: 'PHOTO_CAPTURED', photo_base64: photoBase64 });
      },

      onMatchSelected: (match: any, quantity?: number) => {
        send({ type: 'MATCH_SELECTED', match, quantity });
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
              Choose how you want to add items
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

            <TouchableOpacity
              style={[styles.startScanButton, styles.secondaryButton]}
              onPress={() => send({ type: 'START_PLU_ENTRY' })}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>🔢 Enter PLU Code</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startScanButton, styles.secondaryButton]}
              onPress={() => send({ type: 'START_PHOTO_SCAN' })}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>📸 Scan by Photo</Text>
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

      {/* PLU ENTRY SCREEN - scanning.plu state */}
      {ui.showPLUEntry && <PLUEntryScreen onSubmit={handlers.onPLUEntered} onCancel={handlers.onCancel} />}

      {/* PHOTO CAPTURE SCREEN - scanning.photo state */}
      {ui.showPhotoCapture && <PhotoCaptureScreen onSubmit={handlers.onPhotoCaptured} onCancel={handlers.onCancel} />}

      {/* MATCH SELECTION SCREEN - processing.selectingMatch state */}
      {ui.showMatchSelection && state.context.matches && (
        <MatchSelectionScreen
          matches={state.context.matches}
          onSelect={handlers.onMatchSelected}
          onCancel={handlers.onCancel}
        />
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
      {/* Only render when product exists to prevent null crashes */}
      {ui.showReview && state.context.product && (
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
      )}

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

      {/* SUCCESS SCREEN - complete state */}
      {ui.showSuccess && (
        <View style={styles.homeScreen}>
          <View style={styles.homeContent}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Item Added Successfully</Text>

            {/* Product name */}
            {(state.context.product?.name || state.context.product?.product_name) && (
              <Text style={styles.successProductName}>
                {state.context.product.name || state.context.product.product_name}
              </Text>
            )}

            {/* Storage location */}
            {state.context.storage_location_id && (
              <Text style={styles.successDetails}>
                Added to:{' '}
                {storageLocations.find((loc) => loc.id === state.context.storage_location_id)
                  ?.name || 'Storage'}
              </Text>
            )}

            {/* Scan Another button */}
            <TouchableOpacity
              style={styles.startScanButton}
              onPress={handlers.onScanAnother}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>📱 Scan Another</Text>
              </View>
            </TouchableOpacity>

            {/* Optional: View Inventory button */}
            <TouchableOpacity
              style={[styles.startScanButton, styles.secondaryButton]}
              onPress={() => {
                // Navigate to inventory list (Phase 3 - navigation not yet implemented)
                console.log('[Success] View Inventory button pressed (not yet implemented)')
              }}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>📦 View Inventory</Text>
              </View>
            </TouchableOpacity>
          </View>
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
// PLU Entry Screen Component
// ============================================================================

interface PLUEntryScreenProps {
  onSubmit: (pluCode: string) => void;
  onCancel: () => void;
}

function PLUEntryScreen({ onSubmit, onCancel }: PLUEntryScreenProps) {
  const [pluCode, setPLUCode] = useState('');

  const handleSubmit = () => {
    if (pluCode.length >= 4 && pluCode.length <= 5 && /^\d+$/.test(pluCode)) {
      onSubmit(pluCode);
    }
  };

  return (
    <View style={styles.homeScreen}>
      <View style={styles.homeContent}>
        <Text style={styles.welcomeText}>Enter PLU Code</Text>
        <Text style={styles.instructionText}>
          Enter the 4-5 digit code from the produce sticker
        </Text>

        <TextInput
          style={styles.pluInput}
          value={pluCode}
          onChangeText={setPLUCode}
          placeholder="e.g., 4011"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={5}
          autoFocus
        />

        <TouchableOpacity
          style={[
            styles.startScanButton,
            pluCode.length < 4 && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={pluCode.length < 4}
          activeOpacity={0.7}
        >
          <View style={styles.buttonInner}>
            <Text style={styles.startScanButtonText}>✓ Lookup PLU</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.startScanButton, styles.discardButton]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <View style={styles.buttonInner}>
            <Text style={styles.startScanButtonText}>✕ Cancel</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Photo Capture Screen Component
// ============================================================================

interface PhotoCaptureScreenProps {
  onSubmit: (photoBase64: string) => void;
  onCancel: () => void;
}

function PhotoCaptureScreen({ onSubmit, onCancel }: PhotoCaptureScreenProps) {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleTakePhoto = async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    try {
      // Take photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
      });

      console.log('[PhotoCapture] Photo taken:', photo.path);

      // Resize image on device (512px max, ~100-300KB) - matches existing implementation
      const fileUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      const resizedImage = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      console.log('[PhotoCapture] Image resized, base64 length:', resizedImage.base64?.length);

      if (!resizedImage.base64) {
        throw new Error('Failed to convert image to base64');
      }

      onSubmit(resizedImage.base64);
    } catch (error) {
      console.error('[PhotoCapture] Error taking photo:', error);
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      {device ? (
        <>
          <Camera
            ref={camera}
            style={styles.camera}
            device={device}
            isActive={true}
            photo={true}
          >
            <View style={styles.scanFrame}>
              <View style={styles.scanFrameCorner} />
              <Text style={styles.scanInstruction}>Frame the produce item</Text>
            </View>
          </Camera>

          {/* Capture Button */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonBackground}>
              <TouchableOpacity
                style={[styles.captureButton, isCapturing && styles.disabledButton]}
                onPress={handleTakePhoto}
                disabled={isCapturing}
                activeOpacity={0.8}
              >
                <Text style={styles.captureButtonText}>
                  {isCapturing ? '⏳' : '📸'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.homeScreen}>
          <View style={styles.homeContent}>
            <Text style={styles.errorTitle}>Camera not available</Text>
            <TouchableOpacity
              style={[styles.startScanButton, styles.discardButton]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.startScanButtonText}>✕ Cancel</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Match Selection Screen Component
// ============================================================================

interface MatchSelectionScreenProps {
  matches: any[];
  onSelect: (match: any, quantity?: number) => void;
  onCancel: () => void;
}

function MatchSelectionScreen({ matches, onSelect, onCancel }: MatchSelectionScreenProps) {
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');

  const handleSelect = () => {
    if (selectedMatch) {
      onSelect(selectedMatch, parseInt(quantity) || 1);
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent={false}>
      <View style={styles.matchSelectionContainer}>
        <View style={styles.matchSelectionHeader}>
          <Text style={styles.matchSelectionTitle}>Select Product</Text>
          <Text style={styles.matchSelectionSubtitle}>
            Choose the best match for your item
          </Text>
        </View>

        <FlatList
          data={matches}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.matchItem,
                selectedMatch === item && styles.matchItemSelected,
              ]}
              onPress={() => setSelectedMatch(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.matchItemName}>
                {item.product_name || item.description || 'Unknown Product'}
              </Text>
              {item.nutrition?.energy_kcal && (
                <Text style={styles.matchItemDetails}>
                  {item.nutrition.energy_kcal} cal per serving
                </Text>
              )}
            </TouchableOpacity>
          )}
        />

        {selectedMatch && (
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        )}

        <View style={styles.matchSelectionActions}>
          <TouchableOpacity
            style={[styles.matchActionButton, styles.matchCancelButton]}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.matchCancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.matchActionButton,
              styles.matchSelectButton,
              !selectedMatch && styles.disabledButton,
            ]}
            onPress={handleSelect}
            disabled={!selectedMatch}
            activeOpacity={0.7}
          >
            <Text style={styles.matchSelectButtonText}>Select</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  // Success screen styles
  successIcon: {
    fontSize: 80,
    marginBottom: 20,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 20,
    textAlign: 'center',
  },
  successProductName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successDetails: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 40,
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#1C1C1E',
    marginTop: 15,
  },
  secondaryButtonText: {
    color: '#34C759',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  // PLU Entry screen styles
  pluInput: {
    backgroundColor: '#2C2C2E',
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#34C759',
    marginBottom: 30,
    width: '80%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Match Selection screen styles
  matchSelectionContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  matchSelectionHeader: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  matchSelectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  matchSelectionSubtitle: {
    fontSize: 14,
    color: '#ccc',
  },
  matchItem: {
    backgroundColor: '#2C2C2E',
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
  },
  matchItemSelected: {
    borderColor: '#34C759',
    backgroundColor: '#1C3A28',
  },
  matchItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  matchItemDetails: {
    fontSize: 14,
    color: '#ccc',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  quantityLabel: {
    fontSize: 18,
    color: '#fff',
    marginRight: 15,
  },
  quantityInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
    width: 80,
  },
  matchSelectionActions: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  matchActionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  matchCancelButton: {
    backgroundColor: '#FF3B30',
  },
  matchSelectButton: {
    backgroundColor: '#34C759',
  },
  matchCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  matchSelectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo capture button
  captureButton: {
    backgroundColor: '#34C759',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captureButtonText: {
    fontSize: 40,
    textAlign: 'center',
  },
});
