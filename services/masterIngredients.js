// services/masterIngredients.js
import { supabase } from '../lib/supabase';

export const createIngredientSuggestion = async (productId, productName) => {
  try {
    // Simple ingredient suggestion logic
    // You can make this more sophisticated later
    const suggestedIngredient = extractMainIngredient(productName);
    
    if (!suggestedIngredient) {
      console.log('No ingredient suggestion generated for:', productName);
      return;
    }

    const { data, error } = await supabase
      .from('ingredient_suggestions')
      .insert({
        product_id: productId,
        suggested_master_ingredient: suggestedIngredient,
        confidence_score: 0.7, // Default confidence
        is_accepted: null // Not yet reviewed
      });

    if (error) {
      console.error('Error creating ingredient suggestion:', error);
    } else {
      console.log('Ingredient suggestion created:', suggestedIngredient);
    }

  } catch (error) {
    console.error('Error in createIngredientSuggestion:', error);
  }
};

const extractMainIngredient = (productName) => {
  if (!productName) return null;
  
  const name = productName.toLowerCase().trim();
  
  // Common food mappings - you can expand this
  const ingredientMappings = {
    // Fruits
    'apple': 'Apple',
    'banana': 'Banana',
    'orange': 'Orange',
    'strawberry': 'Strawberry',
    'blueberry': 'Blueberry',
    
    // Vegetables
    'carrot': 'Carrot',
    'broccoli': 'Broccoli',
    'spinach': 'Spinach',
    'tomato': 'Tomato',
    'potato': 'Potato',
    
    // Proteins
    'chicken': 'Chicken',
    'beef': 'Beef',
    'pork': 'Pork',
    'fish': 'Fish',
    'salmon': 'Salmon',
    'turkey': 'Turkey',
    
    // Dairy
    'milk': 'Milk',
    'cheese': 'Cheese',
    'yogurt': 'Yogurt',
    'butter': 'Butter',
    
    // Grains
    'bread': 'Bread',
    'rice': 'Rice',
    'pasta': 'Pasta',
    'oats': 'Oats',
    'quinoa': 'Quinoa',
    
    // Common ingredients
    'egg': 'Egg',
    'oil': 'Oil',
    'sugar': 'Sugar',
    'salt': 'Salt',
    'flour': 'Flour'
  };

  // Look for matches in the product name
  for (const [keyword, ingredient] of Object.entries(ingredientMappings)) {
    if (name.includes(keyword)) {
      return ingredient;
    }
  }

  // If no specific match, try to extract the first meaningful word
  const words = name.split(' ').filter(word => 
    word.length > 2 && 
    !['the', 'and', 'with', 'for', 'organic', 'fresh', 'frozen'].includes(word)
  );

  if (words.length > 0) {
    // Capitalize first letter
    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }

  return null;
};

export const getMasterIngredients = async () => {
  try {
    const { data, error } = await supabase
      .from('master_ingredients')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching master ingredients:', error);
    return [];
  }
};

export const createMasterIngredient = async (name, category = null, description = null) => {
  try {
    const { data, error } = await supabase
      .from('master_ingredients')
      .insert({
        name,
        category,
        description
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating master ingredient:', error);
    return null;
  }
};