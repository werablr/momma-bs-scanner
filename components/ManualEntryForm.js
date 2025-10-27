import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import scannerAPI from '../services/scannerAPI';
import { FOOD_CATEGORIES } from '../utils/constants';
import { supabase } from '../lib/supabase';

export default function ManualEntryForm({ visible, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    product_name: '',
    brand_name: '',
    barcode: '',
    category: '',
    storage_location_id: null,
    expiration_date: new Date(),
    notes: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [storageLocations, setStorageLocations] = useState([]);

  useEffect(() => {
    const loadStorageLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('storage_locations')
          .select('*')
          .order('name');

        if (error) {
          console.error('Error loading storage locations:', error);
          return;
        }

        if (data && data.length > 0) {
          setStorageLocations(data);
        }
      } catch (error) {
        console.error('Failed to load storage locations:', error);
      }
    };

    if (visible) {
      loadStorageLocations();
    }
  }, [visible]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.product_name.trim()) {
      newErrors.product_name = 'Product name is required';
    }
    
    if (!formData.storage_location_id) {
      newErrors.storage_location = 'Storage location is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await scannerAPI.manualEntry({
        product_name: formData.product_name.trim(),
        brand_name: formData.brand_name.trim() || null,
        barcode: formData.barcode.trim() || null,
        category: formData.category || null,
        storage_location_id: formData.storage_location_id,
        expiration_date: formData.expiration_date.toISOString().split('T')[0],
        notes: formData.notes.trim() || null
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success',
          'Product added successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess?.(result);
                resetForm();
                onClose();
              }
            }
          ]
        );
      } else {
        throw new Error(result.error || 'Failed to add product');
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      brand_name: '',
      barcode: '',
      category: '',
      storage_location_id: null,
      expiration_date: new Date(),
      notes: ''
    });
    setErrors({});
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const selectedLocation = storageLocations.find(loc => loc.id === formData.storage_location_id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Manual Product Entry</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={[styles.input, errors.product_name && styles.inputError]}
                value={formData.product_name}
                onChangeText={(text) => handleFieldChange('product_name', text)}
                placeholder="e.g., Organic Tomato Sauce"
              />
              {errors.product_name && (
                <Text style={styles.errorText}>{errors.product_name}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Brand Name</Text>
              <TextInput
                style={styles.input}
                value={formData.brand_name}
                onChangeText={(text) => handleFieldChange('brand_name', text)}
                placeholder="e.g., Muir Glen"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Barcode (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.barcode}
                onChangeText={(text) => handleFieldChange('barcode', text)}
                placeholder="e.g., 041331124027"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[styles.pickerText, !formData.category && styles.placeholder]}>
                  {formData.category || 'Select category'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage & Expiration</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>Storage Location *</Text>
              <TouchableOpacity
                style={[styles.picker, errors.storage_location && styles.inputError]}
                onPress={() => setShowLocationPicker(true)}
              >
                <Text style={[styles.pickerText, !selectedLocation && styles.placeholder]}>
                  {selectedLocation ? selectedLocation.name : 'Select location'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {errors.storage_location && (
                <Text style={styles.errorText}>{errors.storage_location}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Expiration Date</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.pickerText}>
                  {formData.expiration_date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => handleFieldChange('notes', text)}
                placeholder="Additional notes..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Add Product</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Category Picker Modal */}
        <Modal
          visible={showCategoryPicker}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              <ScrollView style={styles.pickerList}>
                {FOOD_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.pickerItem}
                    onPress={() => {
                      handleFieldChange('category', category);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerClose}
                onPress={() => setShowCategoryPicker(false)}
              >
                <Text style={styles.pickerCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Location Picker Modal */}
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <Text style={styles.pickerTitle}>Select Storage Location</Text>
              <ScrollView style={styles.pickerList}>
                {storageLocations.map((location) => (
                  <TouchableOpacity
                    key={location.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      handleFieldChange('storage_location_id', location.id);
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>
                      {location.name}
                    </Text>
                    <Text style={styles.pickerItemSubtext}>{location.description}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerClose}
                onPress={() => setShowLocationPicker(false)}
              >
                <Text style={styles.pickerCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.expiration_date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'android');
              if (date) {
                handleFieldChange('expiration_date', date);
              }
            }}
            minimumDate={new Date()}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 5,
  },
  footer: {
    flexDirection: 'row',
    gap: 15,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#34C759',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Picker Modal Styles
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerList: {
    padding: 20,
  },
  pickerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  pickerClose: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pickerCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});