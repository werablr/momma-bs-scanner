import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { STORAGE_LOCATIONS } from '../utils/constants';

export default function ScanPreview({
  visible,
  onClose,
  onConfirm,
  onEdit,
  productData,
  selectedStorage,
  loading
}) {
  if (!productData) return null;

  const storageLocation = STORAGE_LOCATIONS.find(loc => loc.id === selectedStorage);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.title}>Confirm Product Details</Text>
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

            <View style={styles.detailsContainer}>
              <DetailRow label="Product" value={productData.name} />
              <DetailRow label="Brand" value={productData.brand_name} />
              <DetailRow label="Barcode" value={productData.barcode} />
              
              {productData.volume_info?.description && (
                <DetailRow label="Size" value={productData.volume_info.description} />
              )}
              
              {productData.suggested_category && (
                <DetailRow 
                  label="Category" 
                  value={productData.suggested_category}
                  confidence={productData.confidence_score}
                />
              )}

              <DetailRow 
                label="Storage" 
                value={`${storageLocation?.icon} ${storageLocation?.name}`}
                editable
                onEdit={onEdit}
              />

              {productData.calories && (
                <View style={styles.nutritionHighlight}>
                  <Text style={styles.nutritionLabel}>Calories per serving</Text>
                  <Text style={styles.nutritionValue}>{productData.calories}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmButtonText}>Add to Inventory</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, confidence, editable, onEdit }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueContainer}>
        <Text style={styles.detailValue}>{value || 'Not available'}</Text>
        {confidence !== undefined && (
          <Text style={styles.confidenceBadge}>
            {Math.round(confidence * 100)}% confident
          </Text>
        )}
        {editable && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Text style={styles.editButtonText}>Change</Text>
          </TouchableOpacity>
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
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: 150,
    height: 150,
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginRight: 10,
  },
  confidenceBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  editButton: {
    marginLeft: 'auto',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  nutritionHighlight: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
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
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});