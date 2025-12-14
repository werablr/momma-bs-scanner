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
      function_name: 'identify-photo',
      log_level: level,
      message: message,
      data: data
    })
  } catch (e) {
    console.error('Failed to write to log table:', e)
  }
}

// Call OpenAI GPT-4o to identify PLU code from produce photo
async function identifyPLUFromPhoto(base64Image: string, openaiApiKey: string): Promise<{
  plu_code: string,
  confidence: number,
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
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a produce PLU code identification expert. Analyze produce images and identify the specific 4-5 digit PLU code.

PLU codes are standardized codes used in grocery stores:
- 4-digit codes: Conventionally grown produce (e.g., 4011 = Yellow Banana)
- 5-digit codes starting with 9: Organic produce (e.g., 94011 = Organic Yellow Banana)
- 5-digit codes starting with 8: GMO produce (rarely used)

Common examples:
- Bananas: 4011 (conventional), 94011 (organic)
- Fuji Apple: 4131 (conventional), 94131 (organic)
- Hass Avocado: 4225 (conventional), 94225 (organic)
- Red Bell Pepper: 4688 (conventional), 94688 (organic)

Return a JSON response with:
- plu_code: The 4-5 digit PLU code (string)
- confidence: A number between 0 and 1 indicating your confidence
- reasoning: Brief explanation of your identification

If you cannot identify a specific PLU code, return your best guess based on the visible produce type.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify the PLU code for this produce item. Return only valid JSON with the fields: plu_code, confidence, reasoning.'
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
      max_completion_tokens: 200
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
    plu_code: identified.plu_code || '0000',
    confidence: identified.confidence || 0.5,
    reasoning: identified.reasoning || 'No reasoning provided'
  }
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

    await dbLog(supabaseClient, 'info', 'PLU photo identification started', { base64_length: photo_base64.length, householdId })

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      await dbLog(supabaseClient, 'error', 'OpenAI API key not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Identify PLU code with AI
    await dbLog(supabaseClient, 'debug', 'Calling OpenAI GPT-4o for PLU identification')
    const aiResult = await identifyPLUFromPhoto(photo_base64, openaiApiKey)
    await dbLog(supabaseClient, 'info', 'AI PLU identification complete', aiResult)

    console.log('AI identified PLU:', aiResult.plu_code, 'with confidence:', aiResult.confidence)

    return new Response(
      JSON.stringify({
        success: true,
        plu_code: aiResult.plu_code,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    // SECURITY: Log full error details server-side only
    console.error('Error in identify-photo:', error)
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
