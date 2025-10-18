import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ocrService from '../services/ocrService';

export default function OCRTestingScreen({ visible, onClose }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);

  const testCases = [
    { name: 'Clear Date Format', description: 'Test with MM/DD/YYYY format' },
    { name: 'Embossed Text', description: 'Test with embossed expiration dates' },
    { name: 'Small Text', description: 'Test with very small date text' },
    { name: 'Multiple Dates', description: 'Test with multiple dates on package' },
    { name: 'Poor Lighting', description: 'Test with suboptimal lighting' },
    { name: 'Damaged Label', description: 'Test with partially damaged labels' }
  ];

  const runOCRTest = useCallback(async (testCase) => {
    setIsProcessing(true);
    setCurrentTest(testCase);

    try {
      // Launch image picker for test
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false
      });

      if (!result.canceled && result.assets[0]) {
        const startTime = Date.now();
        
        // Run OCR
        const ocrResult = await ocrService.extractExpirationDate(result.assets[0].uri);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Create test result
        const testResult = {
          id: Date.now(),
          testCase: testCase.name,
          timestamp: new Date().toLocaleTimeString(),
          success: ocrResult.success,
          date: ocrResult.date,
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText,
          ocrText: ocrResult.ocrText,
          processingTime,
          error: ocrResult.error
        };

        setTestResults(prev => [testResult, ...prev]);

        // Show result alert
        if (ocrResult.success && ocrResult.date) {
          Alert.alert(
            'OCR Test Result ✅',
            `Test: ${testCase.name}\n` +
            `Date Found: ${ocrResult.date}\n` +
            `Confidence: ${Math.round(ocrResult.confidence * 100)}%\n` +
            `Processing Time: ${processingTime}ms\n` +
            `Raw Text: "${ocrResult.rawText}"`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'OCR Test Result ❌',
            `Test: ${testCase.name}\n` +
            `Error: ${ocrResult.error || 'No date found'}\n` +
            `Processing Time: ${processingTime}ms\n` +
            `OCR Text: "${ocrResult.ocrText}"`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      Alert.alert('Test Error', `Failed to run test: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentTest(null);
    }
  }, []);

  const clearResults = () => {
    setTestResults([]);
  };

  const exportResults = () => {
    const summary = {
      totalTests: testResults.length,
      successfulTests: testResults.filter(r => r.success).length,
      averageProcessingTime: testResults.reduce((acc, r) => acc + r.processingTime, 0) / testResults.length,
      averageConfidence: testResults.filter(r => r.success).reduce((acc, r) => acc + r.confidence, 0) / testResults.filter(r => r.success).length,
      results: testResults
    };

    console.log('📊 OCR Test Results Summary:', JSON.stringify(summary, null, 2));
    
    Alert.alert(
      'Test Results Exported',
      `Total Tests: ${summary.totalTests}\n` +
      `Success Rate: ${Math.round((summary.successfulTests / summary.totalTests) * 100)}%\n` +
      `Avg Processing Time: ${Math.round(summary.averageProcessingTime)}ms\n` +
      `Avg Confidence: ${Math.round((summary.averageConfidence || 0) * 100)}%\n\n` +
      `Results exported to console.`,
      [{ text: 'OK' }]
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OCR Testing Suite</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Test Cases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Cases</Text>
          {testCases.map((testCase, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.testCaseButton,
                isProcessing && currentTest?.name === testCase.name && styles.testCaseActive
              ]}
              onPress={() => runOCRTest(testCase)}
              disabled={isProcessing}
            >
              <View style={styles.testCaseContent}>
                <Text style={styles.testCaseName}>{testCase.name}</Text>
                <Text style={styles.testCaseDescription}>{testCase.description}</Text>
              </View>
              {isProcessing && currentTest?.name === testCase.name && (
                <ActivityIndicator color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Results Actions */}
        {testResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>Test Results ({testResults.length})</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={exportResults} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearResults} style={[styles.actionButton, styles.clearButton]}>
                  <Text style={styles.actionButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Results List */}
        {testResults.map((result) => (
          <View key={result.id} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTestCase}>{result.testCase}</Text>
              <Text style={styles.resultTimestamp}>{result.timestamp}</Text>
            </View>
            
            <View style={styles.resultDetails}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Status:</Text>
                <Text style={[styles.resultValue, { color: result.success ? '#4CAF50' : '#F44336' }]}>
                  {result.success ? '✅ Success' : '❌ Failed'}
                </Text>
              </View>
              
              {result.success && (
                <>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Date:</Text>
                    <Text style={styles.resultValue}>{result.date}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Confidence:</Text>
                    <Text style={styles.resultValue}>{Math.round(result.confidence * 100)}%</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Raw Text:</Text>
                    <Text style={styles.resultValue}>"{result.rawText}"</Text>
                  </View>
                </>
              )}
              
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Processing Time:</Text>
                <Text style={styles.resultValue}>{result.processingTime}ms</Text>
              </View>
              
              {result.error && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Error:</Text>
                  <Text style={[styles.resultValue, styles.errorText]}>{result.error}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  closeButton: {
    padding: 5
  },
  content: {
    flex: 1,
    padding: 20
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15
  },
  testCaseButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  testCaseActive: {
    backgroundColor: '#e3f2fd'
  },
  testCaseContent: {
    flex: 1
  },
  testCaseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5
  },
  testCaseDescription: {
    fontSize: 14,
    color: '#666'
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5
  },
  clearButton: {
    backgroundColor: '#FF3B30'
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  resultTestCase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  resultTimestamp: {
    fontSize: 12,
    color: '#999'
  },
  resultDetails: {
    gap: 5
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  resultValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right'
  },
  errorText: {
    color: '#F44336'
  }
});