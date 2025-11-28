import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import BarcodeScanner from '../../components/BarcodeScanner';
import ScannerErrorBoundary from '../../components/ScannerErrorBoundary';
import AuthScreen from '../../components/AuthScreen';
import { useAuth } from '../../contexts/AuthContext';
import scannerAPI from '../../services/scannerAPI';

export default function HomeScreen() {
  const { user, household, loading } = useAuth();
  const [scannedProduct, setScannedProduct] = useState<any>(null);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Require authentication
  if (!user) {
    return <AuthScreen />;
  }

  const handleProductScanned = async (product: any) => {
    if (product.requiresManualEntry) {
      // Handle manual entry case
      Alert.alert(
        'Manual Entry Required',
        `Barcode: ${product.barcode}\nPlease add product details manually.`,
        [{ text: 'OK', onPress: () => setScannedProduct(null) }]
      );
    } else {
      // Display the scanned product
      setScannedProduct(product);
      Alert.alert(
        'Product Found!',
        `Name: ${product.name}\nBrand: ${product.brand_name || 'N/A'}\nCalories: ${product.calories || 'N/A'}`,
        [
          { text: 'Scan Another', onPress: () => setScannedProduct(null) },
          { text: 'OK' }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {scannedProduct ? (
        <View style={styles.productInfo}>
          <Text style={styles.title}>Scanned Product</Text>
          
          {/* Product Image */}
          {scannedProduct.photo_thumb && (
            <Image 
              source={{ uri: scannedProduct.photo_thumb }}
              style={styles.productImage}
              resizeMode="contain"
            />
          )}
          
          <Text style={styles.productName}>{scannedProduct.name}</Text>
          <Text style={styles.productBrand}>{scannedProduct.brand_name}</Text>
          <Text style={styles.productCalories}>Calories: {scannedProduct.calories}</Text>
          <Text style={styles.productProtein}>Protein: {scannedProduct.protein}g</Text>
          <Text style={styles.productCarbs}>Carbs: {scannedProduct.total_carbohydrate}g</Text>
          <Text style={styles.productFat}>Fat: {scannedProduct.total_fat}g</Text>
          
          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.scanAnotherButton}
              onPress={() => setScannedProduct(null)}
            >
              <Text style={styles.scanAnotherButtonText}>📱 Scan Another Item</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setScannedProduct(null)}
            >
              <Text style={styles.doneButtonText}>✅ Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScannerErrorBoundary>
          <BarcodeScanner onProductScanned={handleProductScanned} />
        </ScannerErrorBoundary>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  productInfo: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  productImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
    borderRadius: 10,
  },
  productName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  productBrand: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  productCalories: {
    fontSize: 18,
    marginBottom: 10,
  },
  productProtein: {
    fontSize: 16,
    marginBottom: 5,
  },
  productCarbs: {
    fontSize: 16,
    marginBottom: 5,
  },
  productFat: {
    fontSize: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 30,
    gap: 15,
  },
  scanAnotherButton: {
    backgroundColor: '#34C759',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  scanAnotherButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});