import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

export default function ExpirationCapture({
  visible,
  onClose,
  onExpirationCaptured,
  productName
}) {
  const [hasPermission, setHasPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedDate, setExtractedDate] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const cameraRef = useRef(null);

  React.useEffect(() => {
    if (visible) {
      requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      setCapturedImage(photo);
      
      // Process the image for OCR
      await processImageForOCR(photo);
      
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setLoading(false);
    }
  };

  const processImageForOCR = async (photo) => {
    try {
      // Crop and enhance image for better OCR
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          { resize: { width: 800 } },
        ],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true 
        }
      );

      // Simple pattern matching for common date formats
      const extractedText = await performBasicOCR(manipulatedImage.base64);
      const detectedDate = extractDateFromText(extractedText);
      
      if (detectedDate) {
        setExtractedDate(detectedDate);
        Alert.alert(
          'Date Detected',
          `Found expiration date: ${detectedDate}`,
          [
            { text: 'Use This Date', onPress: () => confirmDate(detectedDate) },
            { text: 'Try Again', onPress: () => resetCapture() },
            { text: 'Enter Manually', onPress: () => setShowManualEntry(true) }
          ]
        );
      } else {
        Alert.alert(
          'No Date Found',
          'Could not detect an expiration date. Would you like to enter it manually?',
          [
            { text: 'Try Again', onPress: () => resetCapture() },
            { text: 'Enter Manually', onPress: () => setShowManualEntry(true) },
            { text: 'Skip', onPress: () => onClose() }
          ]
        );
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      setShowManualEntry(true);
    }
  };

  // Basic OCR simulation - in a real app, you'd use Google ML Kit or similar
  const performBasicOCR = async (base64Image) => {
    // This is a placeholder - in production you'd use:
    // - Google ML Kit Text Recognition
    // - AWS Textract
    // - Azure Computer Vision
    // - Or similar OCR service
    
    // For now, we'll simulate text extraction
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
    
    // Return mock OCR result - in reality this would be actual text from image
    return 'BEST BY 12/25/2024 LOT 12345 EXPIRES DEC 25 2024';
  };

  const extractDateFromText = (text) => {
    if (!text) return null;

    const datePatterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      // DD/MM/YYYY or DD-MM-YYYY  
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      // Month DD, YYYY
      /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2}),?\s+(\d{4})/i,
      // DD Month YYYY
      /(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i,
      // YYYY-MM-DD
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return formatDetectedDate(match);
      }
    }

    return null;
  };

  const formatDetectedDate = (match) => {
    // This is a simplified date formatter
    // In production, you'd want more robust date parsing
    try {
      const fullMatch = match[0];
      
      // Try to create a valid date object
      const date = new Date(fullMatch);
      
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      }
      
      return fullMatch; // Return as-is if can't parse
    } catch (error) {
      return match[0];
    }
  };

  const confirmDate = (date) => {
    onExpirationCaptured(date);
    onClose();
  };

  const handleManualDateSubmit = () => {
    if (!manualDate.trim()) {
      Alert.alert('Error', 'Please enter a date');
      return;
    }
    
    confirmDate(manualDate.trim());
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setExtractedDate('');
    setShowManualEntry(false);
  };

  if (hasPermission === null) {
    return null;
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera permission required</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {!showManualEntry ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Capture Expiration Date</Text>
              {productName && (
                <Text style={styles.productName}>{productName}</Text>
              )}
              <Text style={styles.instruction}>
                Point camera at the expiration date on the package
              </Text>
            </View>

            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            />

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.captureButtonText}>📷 Capture</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setShowManualEntry(true)}
              >
                <Text style={styles.manualButtonText}>Enter Manually</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.manualEntryContainer}>
            <Text style={styles.title}>Enter Expiration Date</Text>
            <Text style={styles.instruction}>
              Enter the expiration date (MM/DD/YYYY or any format)
            </Text>

            <TextInput
              style={styles.dateInput}
              value={manualDate}
              onChangeText={setManualDate}
              placeholder="e.g., 12/25/2024 or Dec 25 2024"
              placeholderTextColor="#666"
            />

            <View style={styles.manualControls}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleManualDateSubmit}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowManualEntry(false)}
              >
                <Text style={styles.backButtonText}>Back to Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
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
  header: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  productName: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  controls: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    gap: 15,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  captureButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  manualButtonText: {
    color: 'white',
    fontSize: 16,
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#ccc',
    fontSize: 16,
  },
  manualEntryContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginVertical: 20,
    backgroundColor: '#f9f9f9',
  },
  manualControls: {
    gap: 15,
  },
  confirmButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});