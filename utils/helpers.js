export const formatDate = (dateString) => {
  if (!dateString) return 'Not specified';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatTime = (dateString) => {
  if (!dateString) return 'Not specified';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'Not specified';
  
  return `${formatDate(dateString)} at ${formatTime(dateString)}`;
};

export const getBarcodeType = (barcode) => {
  if (!barcode) return 'unknown';
  
  const length = barcode.length;
  
  if (length === 12) return 'upc_a';
  if (length === 8) return 'upc_e';
  if (length === 13) return 'ean13';
  if (length === 8) return 'ean8';
  
  return 'unknown';
};

export const validateBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return false;
  
  const cleanBarcode = barcode.trim();
  
  // Check if it's all digits
  if (!/^\d+$/.test(cleanBarcode)) return false;
  
  // Check valid lengths
  const validLengths = [8, 12, 13];
  return validLengths.includes(cleanBarcode.length);
};

export const formatNutritionValue = (value, unit = '') => {
  if (value === null || value === undefined) return 'Not available';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'Not available';
  
  if (numValue === 0) return `0${unit ? ' ' + unit : ''}`;
  
  return `${numValue}${unit ? ' ' + unit : ''}`;
};

export const calculateConfidenceColor = (score) => {
  if (score >= 0.8) return '#34C759'; // Green
  if (score >= 0.6) return '#FF9500'; // Orange
  return '#FF3B30'; // Red
};

export const getStorageIcon = (locationName) => {
  const icons = {
    'Refrigerator': '🧊',
    'Freezer': '❄️',
    'Pantry': '🥫',
    'Open Storage Basket': '🧺',
    'Above Air Fryer Cabinet': '🏠',
    'Above Refrigerator Cabinet': '🏠'
  };
  
  return icons[locationName] || '📦';
};