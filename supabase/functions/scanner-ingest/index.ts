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
async function dbLog(supabaseClient: any, level: string, message: string, data: any = null, barcode: string | null = null) {
  try {
    console.log(`[${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data).substring(0, 200) : '')
    await supabaseClient.from('edge_function_logs').insert({
      function_name: 'scanner-ingest',
      log_level: level,
      message: message,
      data: data,
      barcode: barcode
    })
  } catch (e) {
    console.error('Failed to write to log table:', e)
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
    const { workflow, step, barcode, storage_location_id, scan_id, ocr_text, extracted_date, confidence, processing_time_ms, product_name, brand_name, category, expiration_date, notes, idempotency_key } = requestBody

    // Initialize Supabase client with service_role for database operations
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

    // Two-step workflow
    if (workflow === 'two-step') {

      // STEP 1: Barcode scan with storage location
      if (step === 1) {
        await dbLog(supabaseClient, 'info', 'Step 1: Processing barcode', { barcode, storage_location_id, idempotency_key }, barcode)
        console.log('Step 1: Processing barcode:', barcode, 'Storage:', storage_location_id)

        // IDEMPOTENCY: Check if this request has been processed before
        if (idempotency_key) {
          const { data: existingKey, error: keyError } = await supabaseClient
            .from('idempotency_keys')
            .select('response_data, expires_at')
            .eq('key', idempotency_key)
            .single()

          if (existingKey && !keyError) {
            // Check if key is still valid (not expired)
            const expiresAt = new Date(existingKey.expires_at)
            if (expiresAt > new Date()) {
              await dbLog(supabaseClient, 'info', 'Idempotency key cache hit', { idempotency_key }, barcode)
              console.log('✓ Idempotency cache hit, returning cached response')
              return new Response(
                JSON.stringify(existingKey.response_data),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 200,
                }
              )
            } else {
              // Key expired, delete it and continue with fresh request
              await supabaseClient
                .from('idempotency_keys')
                .delete()
                .eq('key', idempotency_key)
              console.log('✓ Idempotency key expired, processing fresh request')
            }
          }
        }

        // PRIORITY 1: Check product_catalog first (avoid API calls if cached)
        await dbLog(supabaseClient, 'debug', 'Checking product_catalog', null, barcode)
        console.log('Checking product_catalog for barcode:', barcode)
        const { data: catalogProduct, error: catalogError } = await supabaseClient
          .rpc('get_product_from_catalog', { p_barcode: barcode })
          .single()

        await dbLog(supabaseClient, 'debug', 'Catalog check complete', { found: !!catalogProduct, error: catalogError?.message }, barcode)

        let upcitemdbData: any = null
        let openfoodfactsData: any = null
        let product: any = null
        let packageSize: number | null = null
        let packageUnit: string | null = null
        let sourcesPriority = 'api_fresh'

        // Multi-source nutrition data (for provenance tracking)
        let offNutrition: any = {}
        let upcNutrition: any = {}

        if (catalogProduct && !catalogError) {
          await dbLog(supabaseClient, 'debug', 'Using cached product data', {
            has_upcitemdb: !!catalogProduct.upcitemdb_data,
            has_openfoodfacts: !!catalogProduct.openfoodfacts_data
          }, barcode)
          console.log('✓ Found in product_catalog (cached), using stored data')
          upcitemdbData = catalogProduct.upcitemdb_data
          openfoodfactsData = catalogProduct.openfoodfacts_data

          // Try to extract product from cached data (priority: OpenFoodFacts > UPCitemdb)
          if (openfoodfactsData?.product?.product_name) {
            product = extractOFFProduct(openfoodfactsData.product)
            offNutrition = extractOFFNutrition(openfoodfactsData.product)
          } else if (upcitemdbData?.items?.[0]) {
            product = extractUPCProduct(upcitemdbData.items[0])
          }

          // Also extract nutrition from other sources if available
          if (openfoodfactsData?.product && !offNutrition.off_calories) {
            offNutrition = extractOFFNutrition(openfoodfactsData.product)
          }

          await dbLog(supabaseClient, 'debug', 'Extracted product from cache', { has_product: !!product, product_name: product?.food_name }, barcode)
          packageSize = catalogProduct.package_size
          packageUnit = catalogProduct.package_unit
          sourcesPriority = 'catalog_cached'
        } else {
          console.log('✗ Not in catalog, calling APIs in parallel...')

          // PERFORMANCE: Call both APIs in parallel using Promise.allSettled
          // This reduces total API time from ~4-6 seconds to ~2-3 seconds
          const [upcResult, offResult] = await Promise.allSettled([
            // API 1: UPCitemdb for package size & pricing
            fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'MommaBsScanner/1.0',
              },
            }).then(res => res.ok ? res.json() : null),

            // API 2: Open Food Facts for health scores & nutrition
            fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
              headers: {
                'User-Agent': 'MommaBsScanner/1.0 (nutritional tracking app)',
              },
            }).then(res => res.ok ? res.json() : null),
          ])

          // Process UPCitemdb result
          if (upcResult.status === 'fulfilled' && upcResult.value) {
            upcitemdbData = upcResult.value
            console.log('✓ UPCitemdb raw response:', JSON.stringify(upcitemdbData).substring(0, 300))
            const item = upcitemdbData?.items?.[0]

            if (item && (item.title || item.description)) {
              console.log('✓ UPCitemdb found product:', item.title || item.description)

              // Use UPCitemdb data as fallback if OFF didn't find product
              if (!product) {
                await dbLog(supabaseClient, 'info', 'Using UPCitemdb as fallback product source', { title: item.title }, barcode)
                console.log('→ Using UPCitemdb as primary product source')
                product = extractUPCProduct(item)
              }

              // Parse package size from title (e.g., "BUSH'S Black Beans 15 oz")
              if (item.title) {
                const parsed = parsePackageSizeFromTitle(item.title)
                if (parsed) {
                  packageSize = parsed.size
                  packageUnit = parsed.unit
                  console.log(`✓ Parsed package size from title: ${packageSize} ${packageUnit}`)
                }
              }
            }
          } else if (upcResult.status === 'rejected') {
            console.error('UPCitemdb API error:', upcResult.reason)
          } else {
            console.log('✗ UPCitemdb API returned no data')
          }

          // Process Open Food Facts result
          if (offResult.status === 'fulfilled' && offResult.value) {
            openfoodfactsData = offResult.value

            if (openfoodfactsData.status === 1 && openfoodfactsData.product) {
              console.log('✓ Open Food Facts found product')
              const offProduct = openfoodfactsData.product

              // Extract nutrition data from OFF
              offNutrition = extractOFFNutrition(offProduct)

              // If still no product data, use Open Food Facts as final fallback
              if (!product && offProduct.product_name) {
                console.log('→ Using Open Food Facts as primary product source')
                product = extractOFFProduct(offProduct)
              }

              // Try to get package size from Open Food Facts if not already found
              if (!packageSize && offProduct.product_quantity) {
                const quantity = parseFloat(offProduct.product_quantity)
                const unit = offProduct.product_quantity_unit || 'g'
                if (!isNaN(quantity)) {
                  packageSize = quantity
                  packageUnit = unit
                  console.log(`✓ Got package size from Open Food Facts: ${packageSize} ${packageUnit}`)
                }
              }
            } else {
              console.log('✗ Product not found in Open Food Facts')
              openfoodfactsData = null
            }
          } else if (offResult.status === 'rejected') {
            console.error('Open Food Facts API error:', offResult.reason)
          } else {
            console.log('✗ Open Food Facts API returned no data')
          }

          // Final check: Did we get product data from ANY source?
          await dbLog(supabaseClient, 'debug', 'Final check - product state', { has_product: !!product, product_value: product }, barcode)
          if (!product) {
            await dbLog(supabaseClient, 'error', 'Product not found in any API', { barcode }, barcode)
            console.error('✗ Product not found in any API (UPCitemdb, Open Food Facts)')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Product not found in any database',
                barcode: barcode,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            )
          }

          console.log('✓ Final product data source:', product.brand_name ? `${product.brand_name} - ${product.food_name}` : product.food_name)

          // Save to product_catalog for future scans
          console.log('Saving to product_catalog...')
          const { data: catalogSaveResult, error: catalogSaveError } = await supabaseClient
            .rpc('upsert_product_catalog', {
              p_barcode: barcode,
              p_package_size: packageSize,
              p_package_unit: packageUnit,
              p_verified_by_user: false,
              p_source_priority: packageSize ? 'title_parsed' : 'none',
              p_data_sources: {
                usda: false, // USDA enrichment now handled by Pantry app
                upcitemdb: upcitemdbData ? true : false,
                openfoodfacts: openfoodfactsData ? true : false,
              },
              p_product_name: product.food_name,
              p_brand_name: product.brand_name,
              p_nutritionix_data: null,
              p_upcitemdb_data: upcitemdbData,
              p_openfoodfacts_data: openfoodfactsData,
              p_usda_data: null, // USDA enrichment now handled by Pantry app
              p_usda_fdc_id: null,
            })

          if (catalogSaveError) {
            console.error('⚠️  Failed to save to product_catalog:', catalogSaveError)
            // Continue anyway - catalog is optional optimization
          } else {
            console.log('✓ Saved to product_catalog:', catalogSaveResult)
          }
        }

        // Extract Open Food Facts health/environmental data
        const offExtracted = extractOpenFoodFactsData(openfoodfactsData)

        // Create inventory item record in database with multi-source nutrition data
        const { data: inventoryItem, error: inventoryError } = await supabaseClient
          .from('inventory_items')
          .insert({
            barcode: barcode,
            storage_location_id: storage_location_id,
            household_id: householdId,

            // Basic product info
            food_name: product.food_name,
            brand_name: product.brand_name,

            // Serving information
            serving_qty: product.serving_qty,
            serving_unit: product.serving_unit,
            serving_weight_grams: product.serving_weight_grams,

            // USDA-specific nutrition data (provenance) - NULL for now, enriched by Pantry app
            usda_calories: null,
            usda_protein: null,
            usda_total_fat: null,
            usda_saturated_fat: null,
            usda_trans_fat: null,
            usda_cholesterol: null,
            usda_sodium: null,
            usda_total_carbohydrate: null,
            usda_dietary_fiber: null,
            usda_sugars: null,
            usda_added_sugars: null,
            usda_potassium: null,
            usda_vitamin_d: null,
            usda_calcium: null,
            usda_iron: null,
            usda_fdc_id: null,
            usda_raw_data: null,

            // OFF-specific nutrition data (provenance)
            off_calories: offNutrition.off_calories,
            off_protein: offNutrition.off_protein,
            off_total_fat: offNutrition.off_total_fat,
            off_saturated_fat: offNutrition.off_saturated_fat,
            off_trans_fat: offNutrition.off_trans_fat,
            off_sodium: offNutrition.off_sodium,
            off_total_carbohydrate: offNutrition.off_total_carbohydrate,
            off_dietary_fiber: offNutrition.off_dietary_fiber,
            off_sugars: offNutrition.off_sugars,
            off_potassium: offNutrition.off_potassium,

            // UPC-specific nutrition data (provenance)
            upc_calories: upcNutrition.upc_calories,
            upc_protein: upcNutrition.upc_protein,
            upc_total_fat: upcNutrition.upc_total_fat,
            upc_sodium: upcNutrition.upc_sodium,

            // Photos from OFF or UPC
            photo_thumb: product.photo_thumb,
            photo_highres: product.photo_highres,

            // Package information (from UPCitemdb or Open Food Facts)
            package_size: packageSize,
            package_unit: packageUnit,

            // Health scores (from Open Food Facts)
            nutriscore_grade: offExtracted.nutriscore_grade,
            nova_group: offExtracted.nova_group,
            ecoscore_grade: offExtracted.ecoscore_grade,
            nutrient_levels: offExtracted.nutrient_levels,

            // Dietary information (from Open Food Facts)
            is_vegan: offExtracted.is_vegan,
            is_vegetarian: offExtracted.is_vegetarian,
            is_palm_oil_free: offExtracted.is_palm_oil_free,
            allergens: offExtracted.allergens,
            traces: offExtracted.traces,

            // Labels & certifications (from Open Food Facts)
            labels: offExtracted.labels,
            labels_tags: offExtracted.labels_tags,

            // Environmental data (from Open Food Facts)
            packaging_type: offExtracted.packaging_type,
            packaging_tags: offExtracted.packaging_tags,
            manufacturing_places: offExtracted.manufacturing_places,
            origins: offExtracted.origins,
            countries: offExtracted.countries,

            // Data sources tracking
            data_sources: {
              usda: false, // USDA enrichment handled by Pantry app
              upcitemdb: upcitemdbData ? true : false,
              openfoodfacts: openfoodfactsData ? true : false,
            },

            status: 'pending', // Waiting for step 2 (expiration date)
          })
          .select()
          .single()

        if (inventoryError) {
          console.error('Database error:', inventoryError)
          throw inventoryError
        }

        console.log('Step 1 complete, inventory_item_id:', inventoryItem.id)

        const responseData = {
          success: true,
          item_id: inventoryItem.id,
          product: {
            name: product.food_name,
            brand: product.brand_name,
            serving_size: product.serving_qty,
            serving_unit: product.serving_unit,
            // Display uses COALESCE(user_*, usda_*, off_*, upc_*) in Pantry app
            calories: offNutrition.off_calories ?? upcNutrition.upc_calories ?? null,
            protein: offNutrition.off_protein ?? upcNutrition.upc_protein ?? null,
            carbs: offNutrition.off_total_carbohydrate ?? null,
            fat: offNutrition.off_total_fat ?? upcNutrition.upc_total_fat ?? null,
          },
          suggested_category: categorizeProduct(product),
          confidence_score: 1.0,
        }

        // IDEMPOTENCY: Cache response if idempotency_key provided
        if (idempotency_key) {
          await supabaseClient
            .from('idempotency_keys')
            .insert({
              key: idempotency_key,
              response_data: responseData,
            })
            .then(() => console.log('✓ Cached response with idempotency key'))
            .catch((err: any) => console.error('⚠️  Failed to cache idempotency key:', err))
        }

        return new Response(
          JSON.stringify(responseData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      // STEP 2: Expiration date capture
      if (step === 2) {
        console.log('Step 2: Processing expiration for item_id:', scan_id)

        // Update inventory item with expiration date and mark as active
        const { data: updatedItem, error: updateError } = await supabaseClient
          .from('inventory_items')
          .update({
            expiration_date: extracted_date,
            ocr_text: ocr_text,
            ocr_confidence: confidence,
            ocr_processing_time_ms: processing_time_ms,
            status: 'active',
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
            item: updatedItem,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    // Manual entry workflow (for items without barcodes)
    if (workflow === 'manual') {
      await dbLog(supabaseClient, 'info', 'Manual entry', { product_name, storage_location_id, idempotency_key }, null)
      console.log('Manual entry:', product_name, 'Storage:', storage_location_id)

      // IDEMPOTENCY: Check if this request has been processed before
      if (idempotency_key) {
        const { data: existingKey, error: keyError } = await supabaseClient
          .from('idempotency_keys')
          .select('response_data, expires_at')
          .eq('key', idempotency_key)
          .single()

        if (existingKey && !keyError) {
          // Check if key is still valid (not expired)
          const expiresAt = new Date(existingKey.expires_at)
          if (expiresAt > new Date()) {
            await dbLog(supabaseClient, 'info', 'Idempotency key cache hit (manual)', { idempotency_key }, null)
            console.log('✓ Idempotency cache hit (manual), returning cached response')
            return new Response(
              JSON.stringify(existingKey.response_data),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            )
          } else {
            // Key expired, delete it and continue with fresh request
            await supabaseClient
              .from('idempotency_keys')
              .delete()
              .eq('key', idempotency_key)
            console.log('✓ Idempotency key expired (manual), processing fresh request')
          }
        }
      }

      // API ENRICHMENT: Try to fetch nutrition data from OFF and USDA
      let openfoodfactsData: any = null
      let usdaData: any = null
      let offNutrition: any = {}
      let usdaNutrition: any = {}

      // Build search query from product_name and brand_name
      const searchQuery = brand_name
        ? `${brand_name} ${product_name}`.trim()
        : product_name

      console.log('Searching APIs for:', searchQuery)

      // PERFORMANCE: Call both APIs in parallel
      const [offResult, usdaResult] = await Promise.allSettled([
        // API 1: Open Food Facts text search
        fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&json=1&page_size=5`, {
          headers: {
            'User-Agent': 'MommaBsScanner/1.0 (nutritional tracking app)',
          },
        }).then(res => res.ok ? res.json() : null),

        // API 2: USDA FoodData Central search
        Deno.env.get('USDA_API_KEY') ? fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${Deno.env.get('USDA_API_KEY')}&query=${encodeURIComponent(searchQuery)}&pageSize=5`, {
          headers: {
            'Accept': 'application/json',
          },
        }).then(res => res.ok ? res.json() : null) : Promise.resolve(null),
      ])

      // Process Open Food Facts result
      if (offResult.status === 'fulfilled' && offResult.value?.products?.[0]) {
        openfoodfactsData = { product: offResult.value.products[0] }
        const offProduct = offResult.value.products[0]

        console.log('✓ Open Food Facts found product:', offProduct.product_name)

        // Extract nutrition data from OFF (metadata not used for manual entries)
        offNutrition = extractOFFNutrition(offProduct)
      } else if (offResult.status === 'rejected') {
        console.error('Open Food Facts API error:', offResult.reason)
      } else {
        console.log('✗ No results from Open Food Facts search')
      }

      // Process USDA FoodData Central result
      if (usdaResult.status === 'fulfilled' && usdaResult.value?.foods?.[0]) {
        usdaData = usdaResult.value
        const usdaFood = usdaResult.value.foods[0]

        console.log('✓ USDA FoodData Central found food:', usdaFood.description)

        // Extract USDA nutrition data (metadata not used for manual entries)
        usdaNutrition = extractUSDANutrition(usdaFood)
      } else if (usdaResult.status === 'rejected') {
        console.error('USDA FoodData Central API error:', usdaResult.reason)
      } else {
        console.log('✗ No results from USDA FoodData Central search (or no API key configured)')
      }

      // Prepare final product data (user input takes priority, enrichment is supplemental)
      const finalFoodName = product_name // Always use user's product name
      const finalBrandName = brand_name || null

      // Create inventory item with minimal data + API enrichment
      // Generate a unique barcode for manual entries (format: MANUAL-timestamp)
      const manualBarcode = barcode || `MANUAL-${Date.now()}`

      const { data: inventoryItem, error: inventoryError } = await supabaseClient
        .from('inventory_items')
        .insert({
          barcode: manualBarcode,
          storage_location_id: storage_location_id,
          household_id: householdId, // SECURITY: Use authenticated user's household

          // Basic product info (user input takes priority)
          food_name: finalFoodName,
          brand_name: finalBrandName,

          // Serving information - NULL for manual entries
          serving_qty: null,
          serving_unit: null,
          serving_weight_grams: null,

          // USDA-specific nutrition data (provenance)
          usda_calories: usdaNutrition.usda_calories,
          usda_protein: usdaNutrition.usda_protein,
          usda_total_fat: usdaNutrition.usda_total_fat,
          usda_saturated_fat: usdaNutrition.usda_saturated_fat,
          usda_trans_fat: usdaNutrition.usda_trans_fat,
          usda_cholesterol: usdaNutrition.usda_cholesterol,
          usda_sodium: usdaNutrition.usda_sodium,
          usda_total_carbohydrate: usdaNutrition.usda_total_carbohydrate,
          usda_dietary_fiber: usdaNutrition.usda_dietary_fiber,
          usda_sugars: usdaNutrition.usda_sugars,
          usda_added_sugars: usdaNutrition.usda_added_sugars,
          usda_potassium: usdaNutrition.usda_potassium,
          usda_vitamin_d: usdaNutrition.usda_vitamin_d,
          usda_calcium: usdaNutrition.usda_calcium,
          usda_iron: usdaNutrition.usda_iron,
          usda_fdc_id: usdaNutrition.usda_fdc_id,
          usda_raw_data: usdaData,

          // OFF-specific nutrition data (provenance)
          off_calories: offNutrition.off_calories,
          off_protein: offNutrition.off_protein,
          off_total_fat: offNutrition.off_total_fat,
          off_saturated_fat: offNutrition.off_saturated_fat,
          off_trans_fat: offNutrition.off_trans_fat,
          off_sodium: offNutrition.off_sodium,
          off_total_carbohydrate: offNutrition.off_total_carbohydrate,
          off_dietary_fiber: offNutrition.off_dietary_fiber,
          off_sugars: offNutrition.off_sugars,
          off_potassium: offNutrition.off_potassium,

          // Photos - NULL for manual entries
          photo_thumb: null,
          photo_highres: null,

          // Package information - NULL for manual entries
          package_size: null,
          package_unit: null,

          // Health scores - NULL for manual entries
          nutriscore_grade: null,
          nova_group: null,
          ecoscore_grade: null,
          nutrient_levels: null,

          // Dietary information - NULL for manual entries
          is_vegan: null,
          is_vegetarian: null,
          is_palm_oil_free: null,
          allergens: null,
          traces: null,

          // Labels & certifications - NULL for manual entries
          labels: null,
          labels_tags: null,

          // Environmental data - NULL for manual entries
          packaging_type: null,
          packaging_tags: null,
          manufacturing_places: null,
          origins: null,
          countries: null,

          // Data sources tracking
          data_sources: {
            usda: usdaData ? true : false,
            upcitemdb: false,
            openfoodfacts: openfoodfactsData ? true : false,
          },

          expiration_date: expiration_date,
          notes: notes || null,
          status: 'pending', // Will be set to active after expiration capture
          volume_remaining: 100, // Default to 100% for manual entries
        })
        .select()
        .single()

      if (inventoryError) {
        await dbLog(supabaseClient, 'error', 'Manual entry database error', inventoryError, null)
        console.error('Manual entry database error:', inventoryError)
        return new Response(
          JSON.stringify({
            success: false,
            error: inventoryError.message,
            details: inventoryError
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      console.log('Manual entry complete with API enrichment, item_id:', inventoryItem.id)

      const responseData = {
        success: true,
        scan_id: inventoryItem.id,
        item: inventoryItem,
        enrichment: {
          off_found: openfoodfactsData ? true : false,
          usda_found: usdaData ? true : false,
        }
      }

      // IDEMPOTENCY: Cache response if idempotency_key provided
      if (idempotency_key) {
        await supabaseClient
          .from('idempotency_keys')
          .insert({
            key: idempotency_key,
            response_data: responseData,
          })
          .then(() => console.log('✓ Cached response with idempotency key (manual)'))
          .catch((err: any) => console.error('⚠️  Failed to cache idempotency key (manual):', err))
      }

      return new Response(
        JSON.stringify(responseData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
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

// ==================== HELPER FUNCTIONS ====================

// Extract product data from Open Food Facts response
function extractOFFProduct(product: any) {
  return {
    food_name: product.product_name || 'Unknown Product',
    brand_name: product.brands || 'Unknown Brand',
    serving_qty: product.serving_quantity ? parseFloat(product.serving_quantity) : null,
    serving_unit: product.serving_quantity_unit || null,
    serving_weight_grams: product.serving_size ? parseFloat(product.serving_size) : null,
    photo_thumb: product.image_small_url || product.image_thumb_url || null,
    photo_highres: product.image_url || null,
  }
}

// Extract nutrition data from Open Food Facts response
function extractOFFNutrition(product: any) {
  const n = product.nutriments || {}

  return {
    // OFF provides per 100g values
    off_calories: n['energy-kcal_100g'] || n['energy-kcal'] || null,
    off_protein: n.proteins_100g || n.proteins || null,
    off_total_fat: n.fat_100g || n.fat || null,
    off_saturated_fat: n['saturated-fat_100g'] || n['saturated-fat'] || null,
    off_trans_fat: n['trans-fat_100g'] || n['trans-fat'] || null,
    off_sodium: n.sodium_100g ? n.sodium_100g * 1000 : (n.sodium ? n.sodium * 1000 : null), // Convert g to mg
    off_total_carbohydrate: n.carbohydrates_100g || n.carbohydrates || null,
    off_dietary_fiber: n.fiber_100g || n.fiber || null,
    off_sugars: n.sugars_100g || n.sugars || null,
    off_potassium: n.potassium_100g || n.potassium || null,
  }
}

// Extract product data from UPCitemdb response
function extractUPCProduct(item: any) {
  return {
    food_name: item.title || item.description || 'Unknown Product',
    brand_name: item.brand || 'Unknown Brand',
    serving_qty: null,
    serving_unit: null,
    serving_weight_grams: null,
    photo_thumb: item.images?.[0] || null,
    photo_highres: item.images?.[0] || null,
  }
}

// Extract nutrition data from USDA FoodData Central response
function extractUSDANutrition(food: any) {
  // USDA FoodData Central provides nutrients in foodNutrients array
  const nutrients = food.foodNutrients || []

  // Helper to find nutrient by name or number
  const findNutrient = (names: string[], nutrientNumbers: number[]) => {
    const nutrient = nutrients.find((n: any) =>
      names.some(name => n.nutrientName?.toLowerCase().includes(name.toLowerCase())) ||
      nutrientNumbers.includes(n.nutrientNumber)
    )
    return nutrient?.value ?? null
  }

  return {
    usda_calories: findNutrient(['energy'], [208]),
    usda_protein: findNutrient(['protein'], [203]),
    usda_total_fat: findNutrient(['total lipid', 'fat'], [204]),
    usda_saturated_fat: findNutrient(['fatty acids, total saturated'], [606]),
    usda_trans_fat: findNutrient(['fatty acids, total trans'], [605]),
    usda_cholesterol: findNutrient(['cholesterol'], [601]),
    usda_sodium: findNutrient(['sodium'], [307]),
    usda_total_carbohydrate: findNutrient(['carbohydrate'], [205]),
    usda_dietary_fiber: findNutrient(['fiber', 'total dietary'], [291]),
    usda_sugars: findNutrient(['sugars, total'], [269]),
    usda_added_sugars: findNutrient(['sugars, added'], [539]),
    usda_potassium: findNutrient(['potassium'], [306]),
    usda_vitamin_d: findNutrient(['vitamin d'], [328]),
    usda_calcium: findNutrient(['calcium'], [301]),
    usda_iron: findNutrient(['iron'], [303]),
    usda_fdc_id: food.fdcId || null,
  }
}

// Helper function to categorize product based on name
function categorizeProduct(product: any): string {
  const name = product.food_name?.toLowerCase() || ''

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

// Helper function to extract health & dietary data from Open Food Facts
function extractOpenFoodFactsData(offData: any) {
  if (!offData || !offData.product) {
    return {}
  }

  const p = offData.product

  // Validate nutriscore - only allow a, b, c, d, e (lowercase)
  let nutriscoreGrade = null
  if (p.nutriscore_grade) {
    const grade = p.nutriscore_grade.toLowerCase()
    if (['a', 'b', 'c', 'd', 'e'].includes(grade)) {
      nutriscoreGrade = grade
    }
  }

  // Validate ecoscore_grade (must be 'a', 'b', 'c', 'd', 'e', or null)
  let ecoscoreGrade: string | null = null
  if (p.ecoscore_grade) {
    const grade = p.ecoscore_grade.toLowerCase()
    if (['a', 'b', 'c', 'd', 'e'].includes(grade)) {
      ecoscoreGrade = grade
    }
  }

  return {
    // Health scores
    nutriscore_grade: nutriscoreGrade,
    nova_group: p.nova_group ? parseInt(p.nova_group) : null,
    ecoscore_grade: ecoscoreGrade,
    nutrient_levels: p.nutrient_levels || null,

    // Dietary flags
    is_vegan: p.ingredients_analysis_tags?.includes('en:vegan') || null,
    is_vegetarian: p.ingredients_analysis_tags?.includes('en:vegetarian') || null,
    is_palm_oil_free: p.ingredients_analysis_tags?.includes('en:palm-oil-free') || null,

    // Allergens
    allergens: p.allergens || null,
    traces: p.traces || null,

    // Labels & certifications
    labels: p.labels || null,
    labels_tags: p.labels_tags || null,

    // Environmental data
    packaging_type: p.packaging || null,
    packaging_tags: p.packaging_tags || null,
    manufacturing_places: p.manufacturing_places || null,
    origins: p.origins || null,
    countries: p.countries || null,
  }
}

// Helper function to parse package size from product title
// Examples: "BUSH'S Black Beans 15 oz" → { size: 15, unit: "oz" }
//          "Coca Cola 2 L" → { size: 2, unit: "L" }
//          "Pasta 1 lb" → { size: 1, unit: "lb" }
function parsePackageSizeFromTitle(title: string): { size: number; unit: string } | null {
  const patterns = [
    // Standard patterns with space: "15 oz", "2 L", "1.5 kg"
    /(\d+\.?\d*)\s*(oz|fl oz|g|kg|lb|lbs|ml|l|qt|gal|ct|count)/i,
    // No space: "15oz", "2L"
    /(\d+\.?\d*)(oz|fl oz|g|kg|lb|lbs|ml|l|qt|gal|ct|count)/i,
    // With dash: "15-oz"
    /(\d+\.?\d*)-\s*(oz|fl oz|g|kg|lb|lbs|ml|l|qt|gal|ct|count)/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      const size = parseFloat(match[1])
      const unit = match[2].toLowerCase()

      // Normalize unit names
      let normalizedUnit = unit
      if (unit === 'lbs') normalizedUnit = 'lb'
      if (unit === 'fl oz') normalizedUnit = 'fl_oz'
      if (unit === 'count' || unit === 'ct') normalizedUnit = 'count'

      return { size, unit: normalizedUnit }
    }
  }

  return null
}
