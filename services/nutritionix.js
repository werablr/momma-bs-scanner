// services/nutritionix.js

const NUTRITIONIX_APP_ID = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID || 'f4d58212';
const NUTRITIONIX_APP_KEY = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY || 'c4aef73c1d82155043c4f3a6f2b9185a';
const NUTRITIONIX_BASE_URL = 'https://trackapi.nutritionix.com/v2';

// API Status and Configuration
const API_STATUS = {
  tier: 'PRODUCTION', // Using production API endpoint
  baseUrl: NUTRITIONIX_BASE_URL,
  version: 'v2',
  rateLimits: {
    // Based on Nutritionix documentation - these are estimates
    freeHacker: '2 users/month, limited requests',
    paidStarter: '200 users/month, $499/month'
  }
};

export const searchByBarcode = async (barcode) => {
  try {
    const response = await fetch(`${NUTRITIONIX_BASE_URL}/search/item?upc=${barcode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_APP_KEY,
      },
    });

    if (response.status === 404) {
      return {
        error: null,
        notFound: true,
        data: null
      };
    }

    if (!response.ok) {
      return {
        error: `API request failed with status ${response.status}`,
        notFound: false,
        data: null
      };
    }

    const data = await response.json();
    
    if (!data.foods || data.foods.length === 0) {
      return {
        error: null,
        notFound: true,
        data: null
      };
    }

    return {
      error: null,
      notFound: false,
      data: data.foods[0] // Return first result
    };

  } catch (error) {
    console.error('Nutritionix API error:', error);
    return {
      error: 'Network error occurred',
      notFound: false,
      data: null
    };
  }
};

export const mapNutritionixToProduct = (nutritionixData) => {
  const nutrients = nutritionixData.full_nutrients || [];
  
  // Helper function to find nutrient by attr_id
  const getNutrient = (attrId) => {
    const nutrient = nutrients.find(n => n.attr_id === attrId);
    return nutrient ? nutrient.value : null;
  };

  return {
    name: nutritionixData.food_name || '',
    brand_name: nutritionixData.brand_name || '',
    serving_qty: nutritionixData.serving_qty || 1,
    serving_unit: nutritionixData.serving_unit || 'serving',
    serving_weight_grams: nutritionixData.serving_weight_grams || null,
    calories: nutritionixData.nf_calories || null,
    total_fat: nutritionixData.nf_total_fat || null,
    saturated_fat: nutritionixData.nf_saturated_fat || null,
    cholesterol: nutritionixData.nf_cholesterol || null,
    sodium: nutritionixData.nf_sodium || null,
    total_carbohydrate: nutritionixData.nf_total_carbohydrate || null,
    dietary_fiber: nutritionixData.nf_dietary_fiber || null,
    sugars: nutritionixData.nf_sugars || null,
    protein: nutritionixData.nf_protein || null,
    potassium: nutritionixData.nf_potassium || null,
    phosphorus: getNutrient(305), // Phosphorus attr_id is 305
    source: 'nutritionix',
    photo_thumb: nutritionixData.photo?.thumb || null,
    photo_highres: nutritionixData.photo?.highres || null,
    photo_is_user_uploaded: false,
    full_nutrients: nutrients,
    nix_brand_id: nutritionixData.nix_brand_id || null,
    nix_item_id: nutritionixData.nix_item_id || null,
    nix_brand_name: nutritionixData.nix_brand_name || null,
    nix_item_name: nutritionixData.nix_item_name || null,
    tags: nutritionixData.tags || null,
    ndb_no: nutritionixData.ndb_no || null,
    alt_measures: nutritionixData.alt_measures || null,
  };
};

// Test API connection and credentials
export const testApiConnection = async () => {
  try {
    const response = await fetch(`${NUTRITIONIX_BASE_URL}/natural/nutrients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify({
        query: '1 apple'
      })
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      tier: API_STATUS.tier,
      endpoint: API_STATUS.baseUrl,
      message: response.ok ? 'API connection successful' : data.message || 'API connection failed',
      data: response.ok ? data : null
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      tier: API_STATUS.tier,
      endpoint: API_STATUS.baseUrl,
      message: error.message,
      data: null
    };
  }
};

// Get API status and configuration
export const getApiStatus = () => {
  return {
    ...API_STATUS,
    credentials: {
      appId: NUTRITIONIX_APP_ID ? 'configured' : 'missing',
      appKey: NUTRITIONIX_APP_KEY ? 'configured' : 'missing',
      fromEnv: {
        appId: !!process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID,
        appKey: !!process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY
      }
    }
  };
};