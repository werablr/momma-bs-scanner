import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = [
  'https://momma-bs-pantry.vercel.app',  // Production Pantry app
  'http://localhost:3000',                // Local Pantry dev
  'http://localhost:3001',                // Local Pantry dev (alternate port)
  'http://192.168.0.211:3000',            // Local network dev
  'http://192.168.0.211:3001',            // Local network dev (alternate port)
  'exp://192.168.0.211:8081',             // Expo development
]

function getCorsHeaders(origin: string | null) {
  // Check if origin is allowed
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Helper function to log to database
async function dbLog(supabaseClient: any, level: string, message: string, data: any = null) {
  try {
    console.log(`[${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data).substring(0, 200) : '')
    await supabaseClient.from('edge_function_logs').insert({
      function_name: 'identify-by-photo',
      log_level: level,
      message: message,
      data: data
    })
  } catch (e) {
    console.error('Failed to write to log table:', e)
  }
}

// Call OpenAI GPT-4 Vision API to identify food item
// Now accepts base64 directly from client for faster processing
async function identifyFoodWithAI(base64Image: string, openaiApiKey: string): Promise<{
  name: string,
  confidence: number,
  category: string,
  reasoning: string
}> {
  console.log('Processing base64 image, length:', base64Image.length)

  const base64DataUrl = `data:image/jpeg;base64,${base64Image}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: `You are a food identification expert. Analyze images and identify food items with precision.
Return a JSON response with:
- name: The specific product name (e.g., "Fuji Apple", "Red Bell Pepper", "Raw Almonds")
- confidence: A number between 0 and 1 indicating your confidence
- category: The food category (e.g., "produce", "bulk", "packaged")
- reasoning: Brief explanation of your identification

Be specific but practical. For produce, include variety if visible (Fuji apple vs Granny Smith). For bulk items, identify the type clearly.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify this food item. Return only valid JSON with the fields: name, confidence, category, reasoning.'
            },
            {
              type: 'image_url',
              image_url: {
                url: base64DataUrl
              }
            }
          ]
        }
      ],
      max_completion_tokens: 300
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('OpenAI API error response:', errorBody)
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`)
  }

  const result = await response.json()
  const content = result.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from OpenAI')
  }

  // Strip markdown code fences if present (OpenAI sometimes wraps JSON in ```json ... ```)
  let cleanContent = content.trim()
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  // Parse JSON response
  const identified = JSON.parse(cleanContent)

  return {
    name: identified.name || 'Unknown',
    confidence: identified.confidence || 0.5,
    category: identified.category || 'unknown',
    reasoning: identified.reasoning || 'No reasoning provided'
  }
}

// Search USDA FoodData Central by product name (fresh produce focus)
async function searchUSDAFoods(productName: string, usdaApiKey: string): Promise<any[]> {
  // Convert product name to search term optimized for USDA
  // E.g., "Bartlett Pear" -> "pear raw", "Fuji Apple" -> "apple raw"
  const searchTerm = prepareUSDASearchTerm(productName)

  const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR Legacy&pageSize=10&api_key=${usdaApiKey}`

  console.log('Searching USDA FoodData for:', searchTerm)

  const response = await fetch(searchUrl)

  if (!response.ok) {
    console.error(`USDA API error: ${response.status}`)
    return []  // Return empty array instead of throwing (USDA is optional)
  }

  const data = await response.json()

  if (!data.foods || data.foods.length === 0) {
    return []
  }

  // Filter out processed foods (Foundation and SR Legacy already contain mostly raw produce)
  return data.foods
    .filter((food: any) => {
      const desc = (food.description || '').toLowerCase()
      // Exclude obviously processed items
      return !desc.includes('canned') &&
             !desc.includes('frozen') &&
             !desc.includes('dried') &&
             !desc.includes('cooked')
    })
    .slice(0, 5)  // Top 5 matches
    .map((food: any) => ({
      source: 'usda',
      fdc_id: food.fdcId,
      product_name: food.description || 'Unknown',
      brands: '',  // USDA doesn't have brands (generic foods)
      image_url: null,  // USDA doesn't provide images
      image_thumb_url: null,
      // Extract nutrition from foodNutrients array
      nutrition: extractUSDANutrition(food.foodNutrients || []),
      // USDA-specific fields for data provenance
      data_type: food.dataType,
      scientific_name: food.scientificName || null,
      ndb_number: food.ndbNumber || null,        // Legacy NDB number (SR Legacy)
      food_code: food.foodCode || null,          // Food code (Survey/FNDDS)
      gtin_upc: food.gtinUpc || null,            // GTIN/UPC (Branded foods)
      match_score: calculateMatchScore(searchTerm, food.description, '')
    }))
    .sort((a: any, b: any) => b.match_score - a.match_score)
}

// Prepare search term for USDA (focus on generic raw foods)
function prepareUSDASearchTerm(productName: string): string {
  let term = productName.toLowerCase()


  // Add "raw" for produce items to prioritize fresh
  const produceItems = ['apple', 'pear', 'banana', 'orange', 'pepper', 'onion', 'tomato', 'carrot', 'broccoli']
  if (produceItems.some(item => term.includes(item))) {
    term = term + ' raw'
  }

  return term.trim()
}

// Extract nutrition data from USDA foodNutrients array
function extractUSDANutrition(nutrients: any[]): any {
  const nutrition: any = {}

  // Map USDA nutrient IDs to our field names (capture everything available)
  const nutrientMap: { [key: number]: string } = {
    1008: 'energy_kcal',      // Energy (kcal)
    1003: 'proteins',         // Protein
    1004: 'fat',              // Total lipid (fat)
    1258: 'saturated_fat',    // Fatty acids, total saturated
    1257: 'trans_fat',        // Fatty acids, total trans
    1005: 'carbohydrates',    // Carbohydrate
    1079: 'fiber',            // Fiber, total dietary
    2000: 'sugars',           // Sugars, total
    1235: 'added_sugars',     // Sugars, added
    1093: 'sodium',           // Sodium
    1253: 'cholesterol',      // Cholesterol
    1087: 'calcium',          // Calcium
    1089: 'iron',             // Iron
    1092: 'potassium',        // Potassium
    1114: 'vitamin_d',        // Vitamin D (D2 + D3)
    1106: 'vitamin_a',        // Vitamin A, RAE
    1162: 'vitamin_c',        // Vitamin C, total ascorbic acid
    1109: 'vitamin_e',        // Vitamin E (alpha-tocopherol)
    1185: 'vitamin_k',        // Vitamin K (phylloquinone)
    1165: 'thiamin',          // Thiamin
    1166: 'riboflavin',       // Riboflavin
    1167: 'niacin',           // Niacin
    1175: 'vitamin_b6',       // Vitamin B-6
    1177: 'folate',           // Folate, total
    1178: 'vitamin_b12',      // Vitamin B-12
    1091: 'phosphorus',       // Phosphorus
    1090: 'magnesium',        // Magnesium
    1095: 'zinc',             // Zinc
    1103: 'selenium',         // Selenium
    1098: 'copper',           // Copper
    1101: 'manganese',        // Manganese
  }

  nutrients.forEach((nutrient: any) => {
    const fieldName = nutrientMap[nutrient.nutrientId]
    if (fieldName && nutrient.value != null) {
      nutrition[fieldName] = nutrient.value
    }
  })

  return nutrition
}

// Search Open Food Facts by product name
async function searchOpenFoodFacts(productName: string): Promise<any[]> {
  const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1&page_size=5`

  console.log('Searching Open Food Facts for:', productName)

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'MommaBsScanner/1.0 (Kitchen Inventory App)'
    }
  })

  if (!response.ok) {
    throw new Error(`Open Food Facts API error: ${response.status}`)
  }

  const data = await response.json()

  if (!data.products || data.products.length === 0) {
    return []
  }

  // Map to consistent format
  return data.products.map((product: any) => ({
    source: 'off',
    product_name: product.product_name || 'Unknown',
    brands: product.brands || '',
    image_url: product.image_url || product.image_front_url || null,
    image_thumb_url: product.image_thumb_url || product.image_small_url || null,
    nutriscore_grade: product.nutriscore_grade || null,
    nova_group: product.nova_group || null,
    categories: product.categories || '',
    quantity: product.quantity || null,
    // Nutrition data (per 100g)
    nutrition: {
      energy_kcal: product.nutriments?.['energy-kcal_100g'] || null,
      proteins: product.nutriments?.proteins_100g || null,
      carbohydrates: product.nutriments?.carbohydrates_100g || null,
      fat: product.nutriments?.fat_100g || null,
      fiber: product.nutriments?.fiber_100g || null,
      sugars: product.nutriments?.sugars_100g || null,
      sodium: product.nutriments?.sodium_100g || null,
    },
    // Dietary flags
    vegetarian: product.ingredients_analysis_tags?.includes('en:vegetarian') ? 1 : 0,
    vegan: product.ingredients_analysis_tags?.includes('en:vegan') ? 1 : 0,
    // Match score for ranking
    match_score: calculateMatchScore(productName, product.product_name, product.brands)
  })).sort((a: any, b: any) => b.match_score - a.match_score)
}

// Calculate match score for ranking results
function calculateMatchScore(searchTerm: string, productName: string, brands: string): number {
  const search = searchTerm.toLowerCase()
  const name = (productName || '').toLowerCase()
  const brand = (brands || '').toLowerCase()

  let score = 0

  // Exact match bonus
  if (name === search) score += 100

  // Starts with search term
  if (name.startsWith(search)) score += 50

  // Contains search term
  if (name.includes(search)) score += 25

  // Brand match
  if (brand.includes(search)) score += 10

  // Word match (each word in search term found in product name)
  const searchWords = search.split(' ')
  const nameWords = name.split(' ')
  const matchingWords = searchWords.filter(word => nameWords.some(nw => nw.includes(word)))
  score += matchingWords.length * 5

  return score
}

// Helper function to get user's household_id from JWT
async function getUserHouseholdId(supabaseClient: any, authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify the JWT and get the user
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

  if (userError || !user) {
    console.error('Failed to verify user token:', userError)
    return null
  }

  // Look up the user's household from user_households table
  const { data: userHousehold, error: householdError } = await supabaseClient
    .from('user_households')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (householdError || !userHousehold) {
    console.error('Failed to get user household:', householdError)
    return null
  }

  return userHousehold.household_id
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    const { photo_base64 } = requestBody

    if (!photo_base64) {
      return new Response(
        JSON.stringify({ success: false, error: 'photo_base64 is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // SECURITY: Get household_id from authenticated user's JWT
    const authHeader = req.headers.get('Authorization')
    const householdId = await getUserHouseholdId(supabaseClient, authHeader)

    if (!householdId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Valid authentication required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    await dbLog(supabaseClient, 'info', 'AI photo identification started', { base64_length: photo_base64.length, householdId })

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      await dbLog(supabaseClient, 'error', 'OpenAI API key not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Step 1: Identify food with AI (base64 sent directly from client)
    await dbLog(supabaseClient, 'debug', 'Calling OpenAI Vision API')
    const aiResult = await identifyFoodWithAI(photo_base64, openaiApiKey)
    await dbLog(supabaseClient, 'info', 'AI identification complete', aiResult)

    console.log('AI identified:', aiResult.name, 'with confidence:', aiResult.confidence)

    // Search USDA for nutrition data based on AI identification
    const usdaApiKey = Deno.env.get('USDA_API_KEY')

    let usdaMatches: any[] = []
    if (usdaApiKey) {
      usdaMatches = await searchUSDAFoods(aiResult.name, usdaApiKey).catch(err => {
        console.error('USDA search failed:', err)
        return []
      })
    }

    console.log('Found', usdaMatches.length, 'USDA matches')

    return new Response(
      JSON.stringify({
        success: true,
        ai_identification: {
          name: aiResult.name,
          confidence: aiResult.confidence,
          category: aiResult.category,
          reasoning: aiResult.reasoning
        },
        matches: usdaMatches,
        usda_matches: usdaMatches.length,
        off_matches: 0,
        total_matches: usdaMatches.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    // SECURITY: Log full error details server-side only
    console.error('Error in identify-by-photo:', error)
    console.error('Error stack:', error.stack)

    // Try to log to database (but don't fail if it errors)
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      await dbLog(supabaseClient, 'error', 'Edge function error', {
        error: error.message,
        stack: error.stack,
        name: error.name
      })
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
    }

    // SECURITY: Return generic error to client (don't expose internal details)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred while processing the image. Please try again.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
