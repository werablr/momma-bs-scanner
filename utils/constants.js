export const STORAGE_LOCATIONS = [
  { id: 1, name: "Refrigerator", icon: "🧊" },
  { id: 2, name: "Freezer", icon: "❄️" },
  { id: 3, name: "Pantry", icon: "🥫" },
  { id: 4, name: "Open Storage Basket", icon: "🧺" },
  { id: 5, name: "Above Air Fryer Cabinet", icon: "🏠" },
  { id: 6, name: "Above Refrigerator Cabinet", icon: "🏠" }
];

// Use environment variables with fallbacks - Updated for enhanced schema project
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bwglyyfcdjzvvjdxxjmk.supabase.co';
export const SUPABASE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL || 'https://bwglyyfcdjzvvjdxxjmk.functions.supabase.co';

// Edge Function URLs using the new format
export const EDGE_FUNCTION_URL = `${SUPABASE_FUNCTION_URL}/scanner-ingest`;
export const REVIEW_API_URL = `${SUPABASE_FUNCTION_URL}/scanner-review-api`;
export const INVENTORY_API_URL = `${SUPABASE_FUNCTION_URL}/add-to-inventory`;

// Food-based categories (3-level hierarchy)
export const FOOD_CATEGORIES = [
  // Soups
  'Soup',
  'Cream of Mushroom',
  'Condensed',
  'Chicken Noodle',
  'Tomato',
  'Vegetable',
  'Beef Broth',
  'Chicken Broth',
  
  // Beans & Legumes
  'Kidney Beans',
  'Black Beans',
  'Chickpeas',
  'Pinto Beans',
  'Navy Beans',
  'Lentils',
  
  // Dairy
  'Milk',
  'Yogurt',
  'Cheese',
  'Butter',
  'Cream',
  
  // Grains & Pasta
  'Rice',
  'Pasta',
  'Bread',
  'Cereal',
  'Oats',
  
  // Proteins
  'Chicken',
  'Beef',
  'Fish',
  'Eggs',
  'Tofu',
  
  // Vegetables
  'Tomatoes',
  'Onions',
  'Carrots',
  'Potatoes',
  'Spinach',
  
  // Fruits
  'Apples',
  'Bananas',
  'Oranges',
  'Berries',
  
  // Condiments & Sauces
  'Ketchup',
  'Mustard',
  'Mayonnaise',
  'Salad Dressing',
  'Hot Sauce',
  
  // Snacks
  'Chips',
  'Crackers',
  'Cookies',
  'Nuts',
  
  // Beverages
  'Juice',
  'Soda',
  'Coffee',
  'Tea',
  'Water',
  
  // Baking
  'Flour',
  'Sugar',
  'Baking Powder',
  'Vanilla',
  'Chocolate Chips'
];

export const DEFAULT_STORAGE_BY_CATEGORY = {
  // Soups
  'Soup': 3, // Pantry
  'Cream of Mushroom': 3, // Pantry
  'Condensed': 3, // Pantry
  'Chicken Noodle': 3, // Pantry
  'Tomato': 3, // Pantry
  'Vegetable': 3, // Pantry
  'Beef Broth': 3, // Pantry
  'Chicken Broth': 3, // Pantry
  
  // Beans & Legumes
  'Kidney Beans': 3, // Pantry
  'Black Beans': 3, // Pantry
  'Chickpeas': 3, // Pantry
  'Pinto Beans': 3, // Pantry
  'Navy Beans': 3, // Pantry
  'Lentils': 3, // Pantry
  
  // Dairy
  'Milk': 1, // Refrigerator
  'Yogurt': 1, // Refrigerator
  'Cheese': 1, // Refrigerator
  'Butter': 1, // Refrigerator
  'Cream': 1, // Refrigerator
  
  // Grains & Pasta
  'Rice': 3, // Pantry
  'Pasta': 3, // Pantry
  'Bread': 3, // Pantry
  'Cereal': 3, // Pantry
  'Oats': 3, // Pantry
  
  // Proteins
  'Chicken': 1, // Refrigerator
  'Beef': 1, // Refrigerator
  'Fish': 1, // Refrigerator
  'Eggs': 1, // Refrigerator
  'Tofu': 1, // Refrigerator
  
  // Vegetables
  'Tomatoes': 1, // Refrigerator
  'Onions': 3, // Pantry
  'Carrots': 1, // Refrigerator
  'Potatoes': 3, // Pantry
  'Spinach': 1, // Refrigerator
  
  // Fruits
  'Apples': 1, // Refrigerator
  'Bananas': 4, // Open Storage Basket
  'Oranges': 1, // Refrigerator
  'Berries': 1, // Refrigerator
  
  // Condiments & Sauces
  'Ketchup': 1, // Refrigerator
  'Mustard': 1, // Refrigerator
  'Mayonnaise': 1, // Refrigerator
  'Salad Dressing': 1, // Refrigerator
  'Hot Sauce': 3, // Pantry
  
  // Snacks
  'Chips': 3, // Pantry
  'Crackers': 3, // Pantry
  'Cookies': 3, // Pantry
  'Nuts': 3, // Pantry
  
  // Beverages
  'Juice': 1, // Refrigerator
  'Soda': 1, // Refrigerator
  'Coffee': 3, // Pantry
  'Tea': 3, // Pantry
  'Water': 3, // Pantry
  
  // Baking
  'Flour': 3, // Pantry
  'Sugar': 3, // Pantry
  'Baking Powder': 3, // Pantry
  'Vanilla': 3, // Pantry
  'Chocolate Chips': 3, // Pantry
};