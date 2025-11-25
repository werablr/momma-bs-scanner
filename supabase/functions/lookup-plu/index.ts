import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PLU code database - maps PLU codes to USDA search terms
const PLU_DATABASE: { [key: string]: string } = {
  '4011': 'banana raw', '94011': 'banana raw organic',
  '3283': 'apple honeycrisp raw', '4130': 'apple granny smith raw',
  '4131': 'apple gala raw', '4133': 'apple golden delicious raw',
  '4135': 'apple red delicious raw', '4015': 'apple gala raw',
  '3107': 'orange navel raw', '4012': 'orange navel raw',
  '4409': 'pear bartlett raw', '4410': 'pear bosc raw',
  '4023': 'grape red seedless raw', '4499': 'grape green seedless raw',
  '4087': 'strawberry raw', '4033': 'blueberry raw',
  '4044': 'peach raw', '4042': 'nectarine raw',
  '4031': 'cantaloupe raw', '4032': 'watermelon raw',
  '4048': 'lime raw', '4053': 'lemon raw',
  '4030': 'kiwi raw', '4052': 'mango raw',
  '4061': 'lettuce iceberg raw', '4062': 'lettuce romaine raw',
  '4060': 'broccoli raw', '4069': 'cauliflower raw',
  '4072': 'carrot raw', '4082': 'onion yellow raw',
  '4065': 'pepper bell green raw', '4688': 'pepper bell red raw',
  '4664': 'tomato raw', '4078': 'avocado raw',
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
    const searchTerm = PLU_DATABASE[pluCode]
    if (!searchTerm) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `PLU code ${pluCode} not found in database`,
          matches: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📖 PLU code maps to:', searchTerm)

    const usdaApiKey = Deno.env.get('USDA_API_KEY')
    if (!usdaApiKey) {
      throw new Error('USDA_API_KEY not configured')
    }

    // Search USDA FoodData Central using the mapped search term
    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR Legacy&pageSize=10&api_key=${usdaApiKey}`

    console.log('Searching USDA for:', searchTerm)
    const response = await fetch(searchUrl)

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.foods || data.foods.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No matches found for this PLU code',
          matches: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map results to match format
    const matches = data.foods
      .filter((food: any) => {
        const desc = (food.description || '').toLowerCase()
        // Filter for raw produce only
        return !desc.includes('canned') &&
               !desc.includes('frozen') &&
               !desc.includes('dried') &&
               !desc.includes('cooked')
      })
      .slice(0, 10)
      .map((food: any) => ({
        source: 'usda',
        fdc_id: food.fdcId,
        product_name: food.description || 'Unknown',
        brands: '',
        image_url: null,
        image_thumb_url: null,
        nutrition: extractUSDANutrition(food.foodNutrients || []),
        data_type: food.dataType,
        scientific_name: food.scientificName || null,
        ndb_number: food.ndbNumber || null,
        food_code: food.foodCode || null,
        gtin_upc: food.gtinUpc || null,
      }))

    console.log(`✅ Found ${matches.length} matches for PLU ${pluCode}`)

    return new Response(
      JSON.stringify({
        success: true,
        plu_code: pluCode,
        matches: matches
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
