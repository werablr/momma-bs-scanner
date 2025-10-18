import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { STORAGE_LOCATIONS, DEFAULT_STORAGE_BY_CATEGORY } from '../utils/constants';

const { width } = Dimensions.get('window');

export default function StorageLocationPicker({
  visible,
  onClose,
  onSelect,
  suggestedCategory,
  productName,
  storageLocations = []
}) {
  // Use database locations if available, otherwise fall back to constants
  const locations = storageLocations.length > 0 ? storageLocations : STORAGE_LOCATIONS;

  const getDefaultLocation = () => {
    // For database locations, find by type instead of ID
    if (storageLocations.length > 0) {
      const pantry = storageLocations.find(loc => loc.type === 'pantry');
      return pantry?.id;
    }

    if (suggestedCategory && DEFAULT_STORAGE_BY_CATEGORY[suggestedCategory]) {
      return DEFAULT_STORAGE_BY_CATEGORY[suggestedCategory];
    }
    return 3; // Default to Pantry (for old constant-based locations)
  };

  const defaultLocationId = getDefaultLocation();

  // Icon mapping for database locations
  const getIcon = (location) => {
    if (location.icon) return location.icon;

    // Map type to icon
    const iconMap = {
      'pantry': '🏪',
      'fridge': '❄️',
      'freezer': '🧊',
      'counter': '🍞',
    };
    return iconMap[location.type] || '📦';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Where are you storing this?</Text>
            {productName && (
              <Text style={styles.productName}>{productName}</Text>
            )}
            {suggestedCategory && (
              <Text style={styles.categoryHint}>
                Suggested for {suggestedCategory}
              </Text>
            )}
          </View>

          <ScrollView style={styles.locationsList}>
            {locations.map((location) => {
              const isDefault = location.id === defaultLocationId;
              return (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationItem,
                    isDefault && styles.defaultLocation
                  ]}
                  onPress={() => onSelect(location)}
                >
                  <Text style={styles.locationIcon}>{getIcon(location)}</Text>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationName}>{location.name}</Text>
                    {isDefault && (
                      <Text style={styles.recommendedBadge}>Recommended</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  categoryHint: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  locationsList: {
    paddingVertical: 10,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  defaultLocation: {
    backgroundColor: '#f0f8ff',
  },
  locationIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  recommendedBadge: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  cancelButton: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
});