import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PLU code database - maps PLU codes directly to USDA FDC IDs
// FDC IDs are from USDA FoodData Central SR Legacy database
const PLU_DATABASE: { [key: string]: { fdc_id: number; name: string } } = {
  // Bananas
  '4011': { fdc_id: 173944, name: 'Bananas, raw' },
  '94011': { fdc_id: 173944, name: 'Bananas, raw (organic)' },

  // Apples
  '3283': { fdc_id: 171688, name: 'Apples, raw, with skin' },
  '4130': { fdc_id: 171688, name: 'Apples, raw, granny smith' },
  '4131': { fdc_id: 171688, name: 'Apples, raw, gala' },
  '4133': { fdc_id: 171688, name: 'Apples, raw, golden delicious' },
  '4135': { fdc_id: 171688, name: 'Apples, raw, red delicious' },
  '4015': { fdc_id: 171688, name: 'Apples, raw, gala' },

  // Oranges
  '3107': { fdc_id: 169097, name: 'Oranges, raw, navels' },
  '4012': { fdc_id: 169097, name: 'Oranges, raw, navels' },

  // Pears
  '4409': { fdc_id: 169118, name: 'Pears, raw' },
  '4410': { fdc_id: 169118, name: 'Pears, raw' },

  // Grapes
  '4023': { fdc_id: 174683, name: 'Grapes, red or green, raw' },
  '4499': { fdc_id: 174683, name: 'Grapes, red or green, raw' },

  // Berries
  '4087': { fdc_id: 167762, name: 'Strawberries, raw' },
  '4033': { fdc_id: 171711, name: 'Blueberries, raw' },

  // Stone fruits
  '4044': { fdc_id: 169900, name: 'Peaches, raw' },
  '4042': { fdc_id: 169921, name: 'Nectarines, raw' },

  // Melons
  '4031': { fdc_id: 169092, name: 'Melons, cantaloupe, raw' },
  '4032': { fdc_id: 167765, name: 'Watermelon, raw' },

  // Citrus
  '4048': { fdc_id: 167746, name: 'Limes, raw' },
  '4053': { fdc_id: 167747, name: 'Lemons, raw, without peel' },

  // Tropical
  '4030': { fdc_id: 167753, name: 'Kiwifruit, green, raw' },
  '4052': { fdc_id: 169910, name: 'Mangos, raw' },

  // Lettuce
  '4061': { fdc_id: 169248, name: 'Lettuce, iceberg, raw' },
  '4062': { fdc_id: 169249, name: 'Lettuce, cos or romaine, raw' },

  // Vegetables
  '4060': { fdc_id: 170379, name: 'Broccoli, raw' },
  '4069': { fdc_id: 170388, name: 'Cauliflower, raw' },
  '4072': { fdc_id: 170393, name: 'Carrots, raw' },
  '4082': { fdc_id: 170000, name: 'Onions, raw' },

  // Peppers
  '4065': { fdc_id: 170427, name: 'Peppers, sweet, green, raw' },
  '4688': { fdc_id: 170108, name: 'Peppers, sweet, red, raw' },

  // Other
  '4664': { fdc_id: 170457, name: 'Tomatoes, red, ripe, raw' },
  '4078': { fdc_id: 171705, name: 'Avocados, raw, all commercial varieties' },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pluCode } = await req.json()

    if (!pluCode) {
      throw new Error('PLU code is required')
    }

    console.log('🔢 Looking up PLU code:', pluCode)

    // Look up PLU code in our database
    const pluData = PLU_DATABASE[pluCode]
    if (!pluData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `PLU code ${pluCode} not found in database`,
          matches: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📖 PLU code maps to:', pluData.name, '(FDC ID:', pluData.fdc_id + ')')

    const usdaApiKey = Deno.env.get('USDA_API_KEY')
    if (!usdaApiKey) {
      throw new Error('USDA_API_KEY not configured')
    }

    // Direct lookup by FDC ID - returns exact match, no fuzzy search
    const lookupUrl = `https://api.nal.usda.gov/fdc/v1/food/${pluData.fdc_id}?api_key=${usdaApiKey}`

    console.log('Fetching USDA food:', pluData.fdc_id)
    const response = await fetch(lookupUrl)

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    const food = await response.json()

    // Create single match from direct lookup
    const match = {
      source: 'usda',
      fdc_id: food.fdcId,
      product_name: pluData.name, // Use our friendly name instead of USDA's technical description
      description: food.description || pluData.name,
      brands: '',
      image_url: null,
      image_thumb_url: null,
      nutrition: extractUSDANutrition(food.foodNutrients || []),
      data_type: food.dataType,
      scientific_name: food.scientificName || null,
      ndb_number: food.ndbNumber || null,
      food_code: food.foodCode || null,
      gtin_upc: food.gtinUpc || null,
    }

    console.log(`✅ Found exact match for PLU ${pluCode}:`, pluData.name)

    return new Response(
      JSON.stringify({
        success: true,
        plu_code: pluCode,
        matches: [match] // Single match - no selection needed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ PLU lookup error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function extractUSDANutrition(nutrients: any[]): any {
  const nutrition: any = {}

  const nutrientMap: { [key: number]: string } = {
    1008: 'energy_kcal',
    1003: 'proteins',
    1004: 'fat',
    1005: 'carbohydrates',
    1079: 'fiber',
    2000: 'sugars',
    1093: 'sodium',
    1087: 'calcium',
    1089: 'iron',
    1092: 'potassium',
    1258: 'saturated_fat',
    1257: 'trans_fat',
    1253: 'cholesterol',
    1235: 'added_sugars',
    1114: 'vitamin_d',
  }

  for (const nutrient of nutrients) {
    const fieldName = nutrientMap[nutrient.nutrientId]
    if (fieldName && nutrient.value != null) {
      nutrition[fieldName] = nutrient.value
    }
  }

  return nutrition
}
