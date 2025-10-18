import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import scannerAPI from '../services/scannerAPI';

const TEST_BARCODE = '051000012616'; // Campbell's Cream of Mushroom

export const WorkflowValidator = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [scanId, setScanId] = useState(null);
  const [results, setResults] = useState({
    step1: null,
    step2: null,
    inventory: null
  });

  const runStep1 = async () => {
    try {
      console.log('🧪 Running Step 1: Barcode Scan');
      const result = await scannerAPI.step1Barcode(TEST_BARCODE, 3); // Pantry
      
      setResults(prev => ({ ...prev, step1: result }));
      setScanId(result.scan_id);
      setCurrentStep(1);
      
      Alert.alert(
        'Step 1 Complete! ✅',
        `Product: ${result.product?.name}\nBrand: ${result.product?.brand_name}\nScan ID: ${result.scan_id}`,
        [{ text: 'Continue to Step 2' }]
      );
    } catch (error) {
      Alert.alert('Step 1 Failed', error.message);
    }
  };

  const runStep2 = async () => {
    try {
      console.log('🧪 Running Step 2: Expiration Date');
      const result = await scannerAPI.step2Expiration(
        scanId,
        'BEST BY 12/25/2025',
        '2025-12-25',
        0.92,
        1250
      );
      
      setResults(prev => ({ ...prev, step2: result }));
      setCurrentStep(2);
      
      Alert.alert(
        'Step 2 Complete! ✅',
        `Expiration: ${result.ocr_results?.extracted_date}\nConfidence: ${(result.ocr_results?.confidence * 100).toFixed(0)}%`,
        [{ text: 'View Summary' }]
      );
    } catch (error) {
      Alert.alert('Step 2 Failed', error.message);
    }
  };

  const getStepStyle = (step) => {
    if (currentStep > step) return styles.stepComplete;
    if (currentStep === step) return styles.stepActive;
    return styles.stepPending;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Workflow Validation</Text>
        <Text style={styles.subtitle}>Campbell's Cream of Mushroom</Text>
        <Text style={styles.barcode}>Barcode: {TEST_BARCODE}</Text>
      </View>

      <View style={styles.steps}>
        <TouchableOpacity 
          style={[styles.step, getStepStyle(0)]}
          onPress={currentStep === 0 ? runStep1 : null}
          disabled={currentStep !== 0}
        >
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepTitle}>Barcode Scan</Text>
          <Text style={styles.stepDesc}>Scan product barcode</Text>
          {results.step1 && (
            <View style={styles.result}>
              <Text style={styles.resultText}>✅ {results.step1.product?.name}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.step, getStepStyle(1)]}
          onPress={currentStep === 1 ? runStep2 : null}
          disabled={currentStep !== 1}
        >
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepTitle}>Expiration OCR</Text>
          <Text style={styles.stepDesc}>Capture expiration date</Text>
          {results.step2 && (
            <View style={styles.result}>
              <Text style={styles.resultText}>✅ {results.step2.ocr_results?.extracted_date}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.step, getStepStyle(2)]}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepTitle}>Add to Inventory</Text>
          <Text style={styles.stepDesc}>Create inventory record</Text>
          {currentStep === 2 && (
            <Text style={styles.readyText}>Ready for inventory!</Text>
          )}
        </View>
      </View>

      {currentStep === 2 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>📊 Validation Summary</Text>
          <Text style={styles.summaryItem}>✅ Product Found: Campbell's Cream of Mushroom</Text>
          <Text style={styles.summaryItem}>✅ Barcode Scanned: {TEST_BARCODE}</Text>
          <Text style={styles.summaryItem}>✅ Expiration Captured: 2025-12-25</Text>
          <Text style={styles.summaryItem}>✅ OCR Confidence: 92%</Text>
          <Text style={styles.summaryItem}>✅ Ready for Inventory</Text>
        </View>
      )}

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close Validator</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 5,
  },
  barcode: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  steps: {
    padding: 20,
  },
  step: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stepPending: {
    opacity: 0.6,
  },
  stepActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  stepComplete: {
    borderColor: '#4caf50',
  },
  stepNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  stepDesc: {
    fontSize: 14,
    color: '#666',
  },
  result: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 5,
  },
  resultText: {
    fontSize: 14,
    color: '#2e7d32',
  },
  readyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  summary: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryItem: {
    fontSize: 16,
    marginBottom: 8,
    color: '#2e7d32',
  },
  closeButton: {
    backgroundColor: '#667eea',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});