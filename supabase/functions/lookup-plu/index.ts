import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query plu_codes table for this PLU code
    // NOTE: PLU codes are NOT unique - same code can have multiple entries (organic, size variants)
    const { data: pluMatches, error: pluError } = await supabase
      .from('plu_codes')
      .select('*')
      .eq('plu_code', pluCode)

    if (pluError || !pluMatches || pluMatches.length === 0) {
      console.log(`❌ PLU code ${pluCode} not found in database`)
      return new Response(
        JSON.stringify({
          success: false,
          error: `PLU code ${pluCode} not found in database`,
          matches: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📖 PLU code ${pluCode} found: ${pluMatches.length} match(es)`)

    // Log all matches
    for (const match of pluMatches) {
      console.log(`  - ${match.commodity} ${match.variety || ''} ${match.size || ''} ${match.restrictions || ''} (FDC: ${match.usda_fdc_id || 'NULL'})`)
    }

    // Build matches array with USDA nutrition for each PLU variant
    const usdaApiKey = Deno.env.get('USDA_API_KEY')
    const matches = []

    for (const pluData of pluMatches) {
      // Build display name from all fields
      const nameParts = [pluData.commodity]
      if (pluData.variety) nameParts.push(pluData.variety)
      if (pluData.size) nameParts.push(`(${pluData.size})`)
      if (pluData.restrictions) nameParts.push(`[${pluData.restrictions}]`)
      const displayName = nameParts.join(' ')

      // If no USDA FDC ID, add match without nutrition
      if (!pluData.usda_fdc_id) {
        console.log(`  ⚠️ No USDA mapping for: ${displayName}`)
        matches.push({
          source: 'plu',
          plu_data: {
            commodity: pluData.commodity,
            variety: pluData.variety,
            size: pluData.size,
            restrictions: pluData.restrictions,
            botanical: pluData.botanical,
            category: pluData.category,
          },
          product_name: displayName,
          description: `${pluData.commodity} (PLU ${pluCode})`,
          brands: '',
          image_url: null,
          image_thumb_url: null,
          nutrition: null,
        })
        continue
      }

      // Fetch USDA nutrition
      if (!usdaApiKey) {
        throw new Error('USDA_API_KEY not configured')
      }

      const lookupUrl = `https://api.nal.usda.gov/fdc/v1/food/${pluData.usda_fdc_id}?api_key=${usdaApiKey}`
      console.log(`  Fetching USDA food: ${pluData.usda_fdc_id} for ${displayName}`)

      const response = await fetch(lookupUrl)
      if (!response.ok) {
        console.error(`  ❌ USDA API error for FDC ${pluData.usda_fdc_id}: ${response.status}`)
        continue
      }

      const food = await response.json()

      console.log(`  DEBUG: USDA food response for FDC ${pluData.usda_fdc_id}:`, JSON.stringify(food).substring(0, 500))
      console.log(`  DEBUG: foodNutrients array length:`, food.foodNutrients?.length || 0)

      const extractedNutrition = extractUSDANutrition(food.foodNutrients || [])
      console.log(`  DEBUG: Extracted nutrition:`, JSON.stringify(extractedNutrition))

      matches.push({
        source: 'usda',
        plu_data: {
          commodity: pluData.commodity,
          variety: pluData.variety,
          size: pluData.size,
          restrictions: pluData.restrictions,
          botanical: pluData.botanical,
          category: pluData.category,
        },
        fdc_id: food.fdcId,
        product_name: displayName,
        description: food.description || pluData.usda_description,
        brands: '',
        image_url: null,
        image_thumb_url: null,
        nutrition: extractedNutrition,
        data_type: food.dataType,
        scientific_name: food.scientificName || pluData.botanical,
        ndb_number: food.ndbNumber || null,
        food_code: food.foodCode || null,
        gtin_upc: food.gtinUpc || null,
      })
    }

    console.log(`✅ Returning ${matches.length} match(es) for PLU ${pluCode}`)

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
    // Handle both API response formats:
    // - Direct lookup API: { nutrientId: 1008, value: 52 }
    // - Food details API: { nutrient: { id: 1008 }, amount: 52 }
    const nutrientId = nutrient.nutrientId || nutrient.nutrient?.id
    const value = nutrient.value ?? nutrient.amount

    const fieldName = nutrientMap[nutrientId]
    if (fieldName && value != null) {
      nutrition[fieldName] = value
    }
  }

  return nutrition
}
