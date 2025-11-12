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
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
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
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  const content = result.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from OpenAI')
  }

  // Parse JSON response
  const identified = JSON.parse(content)

  return {
    name: identified.name || 'Unknown',
    confidence: identified.confidence || 0.5,
    category: identified.category || 'unknown',
    reasoning: identified.reasoning || 'No reasoning provided'
  }
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

    // Step 2: Search Open Food Facts for matches
    await dbLog(supabaseClient, 'debug', 'Searching Open Food Facts', { search_term: aiResult.name })
    const offMatches = await searchOpenFoodFacts(aiResult.name)
    await dbLog(supabaseClient, 'info', 'Open Food Facts search complete', { matches_found: offMatches.length })

    console.log('Found', offMatches.length, 'matches in Open Food Facts')

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
        off_matches: offMatches.slice(0, 5),  // Top 5 matches
        total_matches: offMatches.length,
        photo_url: photo_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in identify-by-photo:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
