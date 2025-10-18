import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { STORAGE_LOCATIONS, DEFAULT_STORAGE_BY_CATEGORY, FOOD_CATEGORIES } from '../utils/constants';
import { correctVolume, getVolumeSuggestion } from '../utils/volumeCorrection';

// Use the new food-based categories from constants
const CATEGORIES = FOOD_CATEGORIES;

const FLAG_REASONS = [
  'Volume/size looks wrong',
  'Wrong product detected',
  'Brand name incorrect',
  'Category doesn\'t match',
  'Nutrition info seems off',
  'Image doesn\'t match',
  'Other issue'
];

export default function EditableReview({
  visible,
  onClose,
  onApprove,
  onFlag,
  productData,
  selectedStorage,
  loading
}) {
  const [editedData, setEditedData] = useState({});
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagNotes, setFlagNotes] = useState('');
  const [validationWarnings, setValidationWarnings] = useState([]);

  useEffect(() => {
    if (productData) {
      setEditedData({
        name: productData.name || '',
        brand_name: productData.brand_name || '',
        suggested_category: productData.suggested_category || '',
        package_description: productData.package_description || '',
        expiration_date: productData.expiration_date || '',
        volume_amount: productData.volume_amount?.toString() || '',
        volume_unit: productData.volume_unit || '',
        serving_qty: productData.serving_qty?.toString() || '',
        serving_unit: productData.serving_unit || '',
      });
      
      // Apply volume corrections for Campbell's soup and other known issues\n      const correctedData = correctVolume(productData);\n      \n      if (correctedData.volume_corrected) {\n        setEditedData(prev => ({\n          ...prev,\n          volume_amount: correctedData.volume_amount.toString(),\n          volume_unit: correctedData.volume_unit,\n          package_description: correctedData.package_description\n        }));\n      }\n      \n      validateData(correctedData.volume_corrected ? correctedData : productData);
    }
  }, [productData]);

  // Enhanced validation for Campbell's soup and other products
  const isValidCampbellsVolume = (brand, product, amount, unit) => {
    if (!brand || !product) return false;
    
    const brandLower = brand.toLowerCase();
    const productLower = product.toLowerCase();
    
    return brandLower.includes('campbell') && 
           productLower.includes('soup') && 
           unit === 'oz' &&
           amount >= 10 && amount <= 11; // Campbell's condensed soups are typically 10.5 oz
  };

  const isValidCanVolume = (product, amount, unit) => {
    if (!product) return false;
    
    const productLower = product.toLowerCase();
    
    // Standard can sizes
    const validCanSizes = [
      { min: 10, max: 11, type: 'condensed soup' }, // 10.5 oz condensed soups
      { min: 14, max: 16, type: 'standard can' },   // 15 oz beans, vegetables
      { min: 28, max: 32, type: 'large can' },      // 28-32 oz crushed tomatoes
      { min: 6, max: 8, type: 'small can' },        // 6-8 oz tomato paste
    ];
    
    if (unit === 'oz') {
      return validCanSizes.some(size => amount >= size.min && amount <= size.max);
    }
    
    return false;
  };

  const validateData = (data) => {
    const warnings = [];
    
    // Skip validation warnings for valid Campbell's soup volumes
    const isValidCampbells = isValidCampbellsVolume(
      data.brand_name, 
      data.name, 
      data.volume_amount, 
      data.volume_unit
    );
    
    // Skip validation for other valid can volumes
    const isValidCan = isValidCanVolume(data.name, data.volume_amount, data.volume_unit);
    
    // Only show volume warnings if it's NOT a valid Campbell's soup or standard can
    if (!isValidCampbells && !isValidCan) {
      // Check for volume extraction issues
      if (data.package_description) {
        const packageDesc = data.package_description.toLowerCase();
        
        // Flag if volume seems to be serving size instead of package size
        if (packageDesc.includes('cup') && data.volume_amount < 5) {
          warnings.push({
            field: 'volume',
            message: 'Volume may be serving size instead of package size',
            suggestion: 'Check actual package size on label (e.g., 10.5 oz can)'
          });
        }
        
        // Check for suspiciously small volumes
        if (data.volume_amount < 1 && data.volume_unit === 'oz') {
          warnings.push({
            field: 'volume',
            message: 'Volume seems too small for package size',
            suggestion: 'Verify this is total package size, not serving'
          });
        }
      }
    }
    
    // Check for generic brand names
    if (data.brand_name && ['generic', 'store brand', 'unknown'].includes(data.brand_name.toLowerCase())) {
      warnings.push({
        field: 'brand',
        message: 'Generic brand detected',
        suggestion: 'Check for actual brand name on package'
      });
    }
    
    // Check for category confidence
    if (data.confidence_score < 0.7) {
      warnings.push({
        field: 'category',
        message: 'Low confidence in product recognition',
        suggestion: 'Verify product details are correct'
      });
    }

    setValidationWarnings(warnings);
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Re-validate when key fields change
    if (['volume_amount', 'volume_unit', 'suggested_category'].includes(field)) {
      validateData({ ...productData, ...editedData, [field]: value });
    }
  };

  const handleApprove = () => {
    const correctedData = {
      ...productData,
      ...editedData,
      volume_amount: parseFloat(editedData.volume_amount) || productData.volume_amount,
      serving_qty: parseFloat(editedData.serving_qty) || productData.serving_qty,
      manual_corrections: getChangedFields(),
      reviewed_by_user: true
    };
    
    onApprove(correctedData);
  };

  const getChangedFields = () => {
    const changes = {};
    Object.keys(editedData).forEach(key => {
      if (editedData[key] !== productData[key]?.toString()) {
        changes[key] = {
          original: productData[key],
          corrected: editedData[key]
        };
      }
    });
    return changes;
  };

  const handleFlag = () => {
    if (!flagReason) {
      Alert.alert('Error', 'Please select a reason for flagging');
      return;
    }
    
    const flagData = {
      reason: flagReason,
      notes: flagNotes,
      original_data: productData,
      user_corrections: getChangedFields(),
      validation_warnings: validationWarnings
    };
    
    onFlag(flagData);
    setShowFlagModal(false);
  };

  const storageLocation = STORAGE_LOCATIONS.find(loc => loc.id === selectedStorage);
  const hasChanges = Object.keys(getChangedFields()).length > 0;
  const hasWarnings = validationWarnings.length > 0;

  if (!productData) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.title}>Review & Edit Product</Text>
              {hasWarnings && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>⚠️ Please review warnings below</Text>
                </View>
              )}
            </View>

            {productData.photo_thumb && (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: productData.photo_thumb }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.formContainer}>
              <FormField
                label="Product Name"
                value={editedData.name}
                onChangeText={(value) => handleFieldChange('name', value)}
                warning={validationWarnings.find(w => w.field === 'name')}
              />

              <FormField
                label="Brand"
                value={editedData.brand_name}
                onChangeText={(value) => handleFieldChange('brand_name', value)}
                warning={validationWarnings.find(w => w.field === 'brand')}
              />

              <CategoryPicker
                label="Category"
                value={editedData.suggested_category}
                onValueChange={(value) => handleFieldChange('suggested_category', value)}
                warning={validationWarnings.find(w => w.field === 'category')}
              />

              <View style={styles.volumeSection}>
                <Text style={styles.sectionTitle}>Package Size</Text>
                {validationWarnings.find(w => w.field === 'volume') && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningBoxText}>
                      ⚠️ {validationWarnings.find(w => w.field === 'volume').message}
                    </Text>
                    <Text style={styles.suggestionText}>
                      💡 {validationWarnings.find(w => w.field === 'volume').suggestion}
                    </Text>
                  </View>
                )}
                
                <View style={styles.volumeRow}>
                  <TextInput
                    style={[styles.volumeInput, styles.amountInput]}
                    value={editedData.volume_amount}
                    onChangeText={(value) => handleFieldChange('volume_amount', value)}
                    placeholder="Amount"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.volumeInput, styles.unitInput]}
                    value={editedData.volume_unit}
                    onChangeText={(value) => handleFieldChange('volume_unit', value)}
                    placeholder="Unit"
                  />
                </View>
                
                <FormField
                  label="Package Description"
                  value={editedData.package_description}
                  onChangeText={(value) => handleFieldChange('package_description', value)}
                  placeholder="e.g., 1 can (10.5 oz)"
                />
              </View>

              <DetailRow 
                label="Storage Location" 
                value={`${storageLocation?.icon} ${storageLocation?.name}`}
                confidence={productData.confidence_score}
              />

              {productData.expiration_date && (
                <DetailRow 
                  label="Expiration Date" 
                  value={new Date(productData.expiration_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                  confidence={productData.ocr_confidence}
                  subtitle={productData.ocr_confidence ? `${Math.round(productData.ocr_confidence * 100)}% OCR confidence` : 'Manual entry'}
                />
              )}

              {productData.calories && (
                <View style={styles.nutritionPreview}>
                  <Text style={styles.nutritionTitle}>Nutrition Preview</Text>
                  <Text style={styles.nutritionText}>
                    {productData.calories} calories per {editedData.serving_qty} {editedData.serving_unit}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.flagButton]} 
              onPress={() => setShowFlagModal(true)}
            >
              <Text style={styles.flagButtonText}>🚩 Flag for Review</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.approveButton]}
              onPress={handleApprove}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.approveButtonText}>
                  {hasChanges ? '✅ Approve with Edits' : '✅ Approve'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Flag Modal */}
      <Modal visible={showFlagModal} animationType="slide" transparent={true}>
        <View style={styles.flagModalOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagModalTitle}>Flag for Manual Review</Text>
            
            <Text style={styles.flagModalLabel}>Why are you flagging this item?</Text>
            <ScrollView style={styles.reasonsList}>
              {FLAG_REASONS.map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.reasonItem,
                    flagReason === reason && styles.reasonItemSelected
                  ]}
                  onPress={() => setFlagReason(reason)}
                >
                  <Text style={[
                    styles.reasonText,
                    flagReason === reason && styles.reasonTextSelected
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.notesInput}
              value={flagNotes}
              onChangeText={setFlagNotes}
              placeholder="Additional notes (optional)"
              multiline
              numberOfLines={3}
            />

            <View style={styles.flagButtonContainer}>
              <TouchableOpacity 
                style={styles.flagSubmitButton} 
                onPress={handleFlag}
              >
                <Text style={styles.flagSubmitButtonText}>Submit Flag</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.flagCancelButton} 
                onPress={() => setShowFlagModal(false)}
              >
                <Text style={styles.flagCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function FormField({ label, value, onChangeText, placeholder, warning }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, warning && styles.fieldInputWarning]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
      {warning && (
        <Text style={styles.fieldWarning}>⚠️ {warning.message}</Text>
      )}
    </View>
  );
}

function CategoryPicker({ label, value, onValueChange, warning }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity 
        style={[styles.pickerButton, warning && styles.fieldInputWarning]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={styles.pickerButtonText}>{value || 'Select category'}</Text>
        <Text style={styles.pickerArrow}>▼</Text>
      </TouchableOpacity>
      
      {warning && (
        <Text style={styles.fieldWarning}>⚠️ {warning.message}</Text>
      )}

      <Modal visible={showPicker} animationType="slide" transparent={true}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerTitle}>Select Category</Text>
            <ScrollView>
              {CATEGORIES.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryItem}
                  onPress={() => {
                    onValueChange(category);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.categoryText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.pickerCancelButton}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, confidence, subtitle }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueContainer}>
        <Text style={styles.detailValue}>{value}</Text>
        {subtitle && (
          <Text style={styles.detailSubtitle}>{subtitle}</Text>
        )}
        {confidence !== undefined && !subtitle && (
          <Text style={styles.confidenceBadge}>
            {Math.round(confidence * 100)}% confident
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '95%',
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 8,
    borderColor: '#FFEAA7',
    borderWidth: 1,
  },
  warningText: {
    color: '#856404',
    textAlign: 'center',
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: 120,
    height: 120,
  },
  formContainer: {
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  fieldInputWarning: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF3E0',
  },
  fieldWarning: {
    color: '#FF9500',
    fontSize: 12,
    marginTop: 5,
  },
  volumeSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  warningBoxText: {
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 5,
  },
  suggestionText: {
    color: '#F57C00',
    fontSize: 12,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  volumeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  amountInput: {
    flex: 1,
  },
  unitInput: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  confidenceBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  detailSubtitle: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  nutritionPreview: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  nutritionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  nutritionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  flagButton: {
    backgroundColor: '#FF9500',
  },
  flagButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  // Flag Modal Styles
  flagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '70%',
    padding: 20,
  },
  flagModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  flagModalLabel: {
    fontSize: 16,
    marginBottom: 15,
    color: '#333',
  },
  reasonsList: {
    maxHeight: 200,
    marginBottom: 15,
  },
  reasonItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
  },
  reasonTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  flagButtonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  flagSubmitButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  flagSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  flagCancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  flagCancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  // Category Picker Modal
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '80%',
    maxHeight: '60%',
    padding: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  categoryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryText: {
    fontSize: 16,
    color: '#333',
  },
  pickerCancelButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  pickerCancelText: {
    color: '#007AFF',
    fontSize: 16,
  },
});