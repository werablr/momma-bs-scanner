import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workflow, step, barcode, storage_location_id, scan_id, ocr_text, extracted_date, confidence, processing_time_ms } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Two-step workflow
    if (workflow === 'two-step') {

      // STEP 1: Barcode scan with storage location
      if (step === 1) {
        console.log('Step 1: Processing barcode:', barcode, 'Storage:', storage_location_id)

        // Lookup product via Nutritionix API
        const nutritionixAppId = Deno.env.get('NUTRITIONIX_APP_ID')
        const nutritionixApiKey = Deno.env.get('NUTRITIONIX_API_KEY')

        if (!nutritionixAppId || !nutritionixApiKey) {
          throw new Error('Nutritionix API credentials not configured')
        }

        // Call Nutritionix API
        const nutritionixResponse = await fetch(
          `https://trackapi.nutritionix.com/v2/search/item?upc=${barcode}`,
          {
            headers: {
              'x-app-id': nutritionixAppId,
              'x-app-key': nutritionixApiKey,
            },
          }
        )

        if (!nutritionixResponse.ok) {
          console.error('Nutritionix API error:', await nutritionixResponse.text())

          // Return partial success with no product data
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Product not found in database',
              barcode: barcode,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200, // Return 200 so app can handle gracefully
            }
          )
        }

        const nutritionixData = await nutritionixResponse.json()
        const product = nutritionixData.foods?.[0]

        if (!product) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Product not found',
              barcode: barcode,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }

        // Create scan record in database
        const { data: scanRecord, error: scanError } = await supabaseClient
          .from('scans')
          .insert({
            barcode: barcode,
            storage_location_id: storage_location_id,
            product_name: product.food_name,
            brand: product.brand_name,
            serving_size: product.serving_qty,
            serving_unit: product.serving_unit,
            calories: product.nf_calories,
            total_fat: product.nf_total_fat,
            saturated_fat: product.nf_saturated_fat,
            cholesterol: product.nf_cholesterol,
            sodium: product.nf_sodium,
            total_carbohydrate: product.nf_total_carbohydrate,
            dietary_fiber: product.nf_dietary_fiber,
            sugars: product.nf_sugars,
            protein: product.nf_protein,
            status: 'pending_expiration', // Waiting for step 2
          })
          .select()
          .single()

        if (scanError) {
          console.error('Database error:', scanError)
          throw scanError
        }

        console.log('Step 1 complete, scan_id:', scanRecord.id)

        return new Response(
          JSON.stringify({
            success: true,
            scan_id: scanRecord.id,
            product: {
              name: product.food_name,
              brand: product.brand_name,
              serving_size: product.serving_qty,
              serving_unit: product.serving_unit,
              calories: product.nf_calories,
              protein: product.nf_protein,
              carbs: product.nf_total_carbohydrate,
              fat: product.nf_total_fat,
            },
            suggested_category: categorizeProduct(product),
            confidence_score: 1.0,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      // STEP 2: Expiration date capture
      if (step === 2) {
        console.log('Step 2: Processing expiration for scan_id:', scan_id)

        // Update scan record with expiration date
        const { data: updatedScan, error: updateError } = await supabaseClient
          .from('scans')
          .update({
            expiration_date: extracted_date,
            ocr_text: ocr_text,
            ocr_confidence: confidence,
            ocr_processing_time_ms: processing_time_ms,
            status: 'complete',
          })
          .eq('id', scan_id)
          .select()
          .single()

        if (updateError) {
          console.error('Update error:', updateError)
          throw updateError
        }

        console.log('Step 2 complete')

        return new Response(
          JSON.stringify({
            success: true,
            scan: updatedScan,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    // Invalid request
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Helper function to categorize product based on nutritional data
function categorizeProduct(product: any): string {
  const name = product.food_name?.toLowerCase() || ''
  const brand = product.brand_name?.toLowerCase() || ''

  // Simple categorization logic
  if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt')) {
    return 'dairy'
  }
  if (name.includes('meat') || name.includes('chicken') || name.includes('beef') || name.includes('pork')) {
    return 'protein'
  }
  if (name.includes('bread') || name.includes('pasta') || name.includes('rice')) {
    return 'grains'
  }
  if (name.includes('fruit') || name.includes('apple') || name.includes('banana')) {
    return 'produce'
  }
  if (name.includes('vegetable') || name.includes('carrot') || name.includes('lettuce')) {
    return 'produce'
  }
  if (name.includes('frozen')) {
    return 'frozen'
  }
  if (name.includes('snack') || name.includes('chip') || name.includes('cookie')) {
    return 'snacks'
  }

  return 'other'
}
