// Volume correction utilities for common extraction errors

export const correctVolume = (productData) => {
  if (!productData) return productData;

  const correctedData = { ...productData };
  
  // Campbell's soup volume correction
  if (isCampbellsSoup(productData)) {
    const correctedVolume = correctCampbellsSoupVolume(productData);
    if (correctedVolume) {
      correctedData.volume_amount = correctedVolume.amount;
      correctedData.volume_unit = correctedVolume.unit;
      correctedData.package_description = correctedVolume.description;
      correctedData.volume_corrected = true;
    }
  }
  
  // Other volume corrections can be added here
  
  return correctedData;
};

const isCampbellsSoup = (data) => {
  if (!data.brand_name || !data.name) return false;
  
  const brand = data.brand_name.toLowerCase();
  const product = data.name.toLowerCase();
  
  return brand.includes('campbell') && product.includes('soup');
};

const correctCampbellsSoupVolume = (data) => {
  // If volume is 4.3 oz (serving size), correct to 10.5 oz (can size)
  if (data.volume_amount === 4.3 && data.volume_unit === 'oz') {
    return {
      amount: 10.5,
      unit: 'oz',
      description: '1 can (10.5 oz)'
    };
  }
  
  // If package description mentions serving, suggest can size
  if (data.package_description?.includes('cup') && data.volume_amount < 5) {
    return {
      amount: 10.5,
      unit: 'oz', 
      description: '1 can (10.5 oz)'
    };
  }
  
  return null;
};

export const getVolumeSuggestion = (productData) => {
  if (!productData) return null;
  
  if (isCampbellsSoup(productData)) {
    if (productData.volume_amount === 4.3) {
      return {
        message: 'Detected serving size. Campbell\'s condensed soups are typically 10.5 oz cans.',
        suggestedAmount: 10.5,
        suggestedUnit: 'oz',
        suggestedDescription: '1 can (10.5 oz)'
      };
    }
  }
  
  return null;
};