import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import ocrService from '../services/ocrService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ExpirationDateCapture({ visible, onClose, onDateCaptured, productName, scanId, workflowStep }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);
  
  const timeoutRef = useRef(null);
  
  const camera = useRef(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Auto-advance timeout - show skip prompt after 20 seconds
  React.useEffect(() => {
    if (visible && !capturedImage && !ocrResult) {
      timeoutRef.current = setTimeout(() => {
        setShowSkipPrompt(true);
      }, 20000); // 20 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, capturedImage, ocrResult]);

  const handleCapture = useCallback(async () => {
    if (!camera.current) return;

    try {
      setIsProcessing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await camera.current.takePhoto({
        flash: flashEnabled ? 'on' : 'off',
        enableShutterSound: true
      });

      setCapturedImage(photo.path);
      
      // Process OCR
      const result = await ocrService.extractExpirationDate(photo.path);
      
      if (result.success && result.date) {
        setOcrResult(result);
        setSelectedDate(new Date(result.date));
        
        if (result.confidence >= 0.85) {
          // High confidence - auto accept
          handleAcceptDate(result.date, result.confidence, result.ocrText);
        }
      } else {
        // No date found - show manual picker
        Alert.alert(
          'No Date Found',
          'Unable to detect expiration date. Please enter manually.',
          [
            {
              text: 'Enter Manually',
              onPress: () => setShowDatePicker(true)
            },
            {
              text: 'Try Again',
              onPress: () => {
                setCapturedImage(null);
                setOcrResult(null);
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Capture Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [flashEnabled]);

  const handlePickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setIsProcessing(true);
      setCapturedImage(result.assets[0].uri);
      
      const ocrResult = await ocrService.extractExpirationDate(result.assets[0].uri);
      setIsProcessing(false);
      
      if (ocrResult.success && ocrResult.date) {
        setOcrResult(ocrResult);
        setSelectedDate(new Date(ocrResult.date));
      } else {
        setShowDatePicker(true);
      }
    }
  }, []);

  const handleAcceptDate = useCallback((date, confidence, ocrText) => {
    onDateCaptured({
      date,
      confidence,
      ocrText,
      method: confidence > 0 ? 'ocr' : 'manual'
    });
    resetState();
    onClose();
  }, [onDateCaptured, onClose]);

  const handleManualDate = useCallback(() => {
    const dateString = selectedDate.toISOString().split('T')[0];
    handleAcceptDate(dateString, 0, '');
  }, [selectedDate, handleAcceptDate]);

  const handleClose = useCallback(() => {
    // Treat close as skip - complete Step 2 with null expiration date
    onDateCaptured({
      date: null,
      confidence: 0,
      ocrText: 'User closed without setting expiration',
      method: 'skipped',
      processingTimeMs: 0
    });
    resetState();
    onClose();
  }, [onDateCaptured, onClose, resetState]);

  const handleSkipExpiration = useCallback(() => {
    Alert.alert(
      'Skip Expiration Date',
      'Are you sure you want to skip scanning the expiration date? The item will be added without this information.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            onDateCaptured({
              date: null,
              confidence: 0,
              ocrText: 'User skipped expiration scanning',
              method: 'skipped',
              processingTimeMs: 0
            });
            resetState();
            onClose();
          }
        }
      ]
    );
  }, [onDateCaptured, onClose, resetState]);

  const resetState = useCallback(() => {
    setCapturedImage(null);
    setOcrResult(null);
    setShowDatePicker(false);
    setIsProcessing(false);
    setShowSkipPrompt(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const renderCamera = () => {
    if (!device) {
      return (
        <View style={styles.noCamera}>
          <Text style={styles.noCameraText}>No camera available</Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.noCamera}>
          <Text style={styles.noCameraText}>Camera permission required</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={visible && !capturedImage}
        photo={true}
        torch={flashEnabled ? 'on' : 'off'}
      />
    );
  };

  const renderOverlay = () => (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Scan Expiration Date</Text>
          {workflowStep && (
            <Text style={styles.stepIndicator}>Step 2 of 2</Text>
          )}
        </View>
        
        <TouchableOpacity 
          onPress={() => setFlashEnabled(!flashEnabled)} 
          style={styles.flashButton}
        >
          <Ionicons 
            name={flashEnabled ? "flash" : "flash-off"} 
            size={28} 
            color="white" 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Point camera at the expiration date on {productName || 'the product'}
        </Text>
        {scanId && (
          <Text style={styles.scanIdText}>Scan ID: {scanId}</Text>
        )}
      </View>

      <View style={styles.focusArea}>
        <View style={styles.focusFrame}>
          <View style={[styles.focusCorner, styles.topLeft]} />
          <View style={[styles.focusCorner, styles.topRight]} />
          <View style={[styles.focusCorner, styles.bottomLeft]} />
          <View style={[styles.focusCorner, styles.bottomRight]} />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.galleryButton} 
          onPress={handlePickFromGallery}
        >
          <Ionicons name="images" size={28} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={isProcessing || !!capturedImage}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.manualButton} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.skipSection}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkipExpiration}
        >
          <Text style={styles.skipButtonText}>⏭ Skip Expiration Date</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResult = () => {
    if (!ocrResult || !ocrResult.date) return null;

    const confidence = Math.round(ocrResult.confidence * 100);
    const confidenceColor = confidence >= 85 ? '#4CAF50' : confidence >= 70 ? '#FF9800' : '#F44336';

    return (
      <View style={styles.resultOverlay}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Expiration Date Found</Text>
          
          <Text style={styles.resultDate}>
            {ocrService.formatDateForDisplay(ocrResult.date)}
          </Text>
          
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <Text style={[styles.confidenceValue, { color: confidenceColor }]}>
              {confidence}%
            </Text>
          </View>

          {ocrResult.rawText && (
            <Text style={styles.rawText}>Detected: "{ocrResult.rawText}"</Text>
          )}

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAcceptDate(ocrResult.date, ocrResult.confidence, ocrResult.ocrText)}
            >
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={() => {
                setCapturedImage(null);
                setOcrResult(null);
              }}
            >
              <Text style={styles.actionButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {renderCamera()}
        {renderOverlay()}
        {ocrResult && renderResult()}

        {showDatePicker && (
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerCard}>
              <Text style={styles.datePickerTitle}>Select Expiration Date</Text>
              
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  if (date) setSelectedDate(date);
                }}
                minimumDate={new Date()}
              />

              <View style={styles.datePickerActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleManualDate}
                >
                  <Text style={styles.actionButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showSkipPrompt && (
          <View style={styles.skipPromptOverlay}>
            <View style={styles.skipPromptCard}>
              <Text style={styles.skipPromptTitle}>Having trouble?</Text>
              <Text style={styles.skipPromptText}>
                We noticed you haven't scanned the expiration date yet. Would you like to:
              </Text>
              
              <View style={styles.skipPromptActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.continueButton]}
                  onPress={() => setShowSkipPrompt(false)}
                >
                  <Text style={styles.actionButtonText}>Keep Trying</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.skipFromPromptButton]}
                  onPress={() => {
                    setShowSkipPrompt(false);
                    handleSkipExpiration();
                  }}
                >
                  <Text style={styles.actionButtonText}>Skip This Step</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  noCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  noCameraText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeButton: {
    padding: 10,
  },
  flashButton: {
    padding: 10,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
  },
  stepIndicator: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanIdText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  focusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: screenWidth * 0.8,
    height: 120,
    position: 'relative',
  },
  focusCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'white',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: 'black',
  },
  galleryButton: {
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
  },
  manualButton: {
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
  },
  skipSection: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  skipButton: {
    backgroundColor: 'rgba(255,193,7,0.9)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: screenWidth * 0.9,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  resultDate: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  confidenceLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  rawText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  actionButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 80,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  retryButton: {
    backgroundColor: '#FF9800',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: screenWidth * 0.9,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  skipPromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipPromptCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: screenWidth * 0.85,
    alignItems: 'center',
  },
  skipPromptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  skipPromptText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
    lineHeight: 22,
  },
  skipPromptActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
  },
  skipFromPromptButton: {
    backgroundColor: '#FF9800',
  },
});