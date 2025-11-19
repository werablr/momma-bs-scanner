import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
async function identifyFoodWithAI(imageUrl: string, openaiApiKey: string): Promise<{
  name: string,
  confidence: number,
  category: string,
  reasoning: string
}> {
  // Fetch the image and convert to base64
  console.log('Fetching image from:', imageUrl)
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()

  // Convert to base64 in chunks to avoid stack overflow
  const bytes = new Uint8Array(imageBuffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  const base64Image = btoa(binary)
  const base64DataUrl = `data:image/jpeg;base64,${base64Image}`

  console.log('Converted image to base64, size:', base64Image.length)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
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
      max_tokens: 300
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

  // Filter for fresh/raw foods and map to consistent format
  return data.foods
    .filter((food: any) => {
      const desc = (food.description || '').toLowerCase()
      // Prefer raw/fresh items, exclude canned/frozen/dried
      return desc.includes('raw') ||
             (!desc.includes('canned') &&
              !desc.includes('frozen') &&
              !desc.includes('dried') &&
              !desc.includes('cooked'))
    })
    .slice(0, 5)  // Top 5 fresh matches
    .map((food: any) => ({
      source: 'usda',
      fdc_id: food.fdcId,
      product_name: food.description || 'Unknown',
      brands: '',  // USDA doesn't have brands (generic foods)
      image_url: null,  // USDA doesn't provide images
      image_thumb_url: null,
      // Extract nutrition from foodNutrients array
      nutrition: extractUSDANutrition(food.foodNutrients || []),
      // USDA-specific fields
      data_type: food.dataType,
      scientific_name: food.scientificName || null,
      match_score: calculateMatchScore(searchTerm, food.description, '')
    }))
    .sort((a: any, b: any) => b.match_score - a.match_score)
}

// Prepare search term for USDA (focus on generic raw foods)
function prepareUSDASearchTerm(productName: string): string {
  let term = productName.toLowerCase()

  // Remove variety names (Fuji, Bartlett, etc.) - USDA uses generic terms
  const varieties = ['fuji', 'gala', 'granny smith', 'honeycrisp', 'bartlett', 'bosc', 'anjou']
  varieties.forEach(variety => {
    term = term.replace(variety, '').trim()
  })

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

  // Map USDA nutrient IDs to our field names
  const nutrientMap: { [key: number]: string } = {
    1008: 'energy_kcal',      // Energy (kcal)
    1003: 'proteins',         // Protein
    1004: 'fat',              // Total lipid (fat)
    1005: 'carbohydrates',    // Carbohydrate
    1079: 'fiber',            // Fiber, total dietary
    2000: 'sugars',           // Sugars, total
    1093: 'sodium',           // Sodium
    1087: 'calcium',          // Calcium
    1089: 'iron',             // Iron
    1092: 'potassium',        // Potassium
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    const { photo_url, household_id, storage_location_id } = requestBody

    if (!photo_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'photo_url is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    await dbLog(supabaseClient, 'info', 'AI photo identification started', { photo_url, household_id })

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      await dbLog(supabaseClient, 'error', 'OpenAI API key not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Step 1: Identify food with AI
    await dbLog(supabaseClient, 'debug', 'Calling OpenAI Vision API')
    const aiResult = await identifyFoodWithAI(photo_url, openaiApiKey)
    await dbLog(supabaseClient, 'info', 'AI identification complete', aiResult)

    console.log('AI identified:', aiResult.name, 'with confidence:', aiResult.confidence)

    // Step 2: Search both USDA and Open Food Facts in parallel
    const usdaApiKey = Deno.env.get('USDA_API_KEY')

    await dbLog(supabaseClient, 'debug', 'Searching USDA and OFF in parallel', { search_term: aiResult.name })

    const [usdaMatches, offMatches] = await Promise.all([
      usdaApiKey
        ? searchUSDAFoods(aiResult.name, usdaApiKey).catch(err => {
            console.error('USDA search failed:', err)
            return []
          })
        : Promise.resolve([]),
      searchOpenFoodFacts(aiResult.name).catch(err => {
        console.error('OFF search failed:', err)
        return []
      })
    ])

    await dbLog(supabaseClient, 'info', 'Search results', {
      usda_matches: usdaMatches.length,
      off_matches: offMatches.length
    })

    console.log('Found', usdaMatches.length, 'USDA matches and', offMatches.length, 'OFF matches')

    // Combine and sort matches by source and score
    // USDA first (fresh produce), then OFF (packaged items)
    const allMatches = [
      ...usdaMatches.map((m: any) => ({ ...m, source: 'usda' })),
      ...offMatches.map((m: any) => ({ ...m, source: 'off' }))
    ]

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        ai_identification: {
          name: aiResult.name,
          confidence: aiResult.confidence,
          category: aiResult.category,
          reasoning: aiResult.reasoning
        },
        matches: allMatches,
        usda_matches: usdaMatches.length,
        off_matches: offMatches.length,
        total_matches: allMatches.length,
        photo_url: photo_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in identify-by-photo:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', JSON.stringify(error, null, 2))

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

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        error_name: error.name,
        error_details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
