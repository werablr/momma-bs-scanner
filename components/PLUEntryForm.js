import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PLUEntryForm({ visible, onClose, onSubmit }) {
  const [pluCode, setPluCode] = useState('');

  const handleSubmit = () => {
    if (!pluCode.trim()) {
      Alert.alert('Error', 'Please enter a PLU code');
      return;
    }

    // Validate PLU code (4 or 5 digits)
    const trimmed = pluCode.trim();
    if (!/^\d{4,5}$/.test(trimmed)) {
      Alert.alert('Invalid PLU', 'PLU code must be 4 or 5 digits');
      return;
    }

    onSubmit(trimmed);
    setPluCode('');
  };

  const handleClose = () => {
    setPluCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Enter PLU Code</Text>
          <Text style={styles.subtitle}>Find the 4-5 digit code on produce sticker</Text>

          <TextInput
            style={styles.input}
            value={pluCode}
            onChangeText={setPluCode}
            placeholder="e.g., 4011 (Bananas)"
            keyboardType="number-pad"
            maxLength={5}
            autoFocus={true}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Look Up</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
  },
  input: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 10,
    padding: 15,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: 'bold',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#FF9500',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
