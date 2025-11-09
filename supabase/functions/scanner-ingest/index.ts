import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    const { workflow, step, barcode, storage_location_id, scan_id, ocr_text, extracted_date, confidence, processing_time_ms, product_name, brand_name, category, expiration_date, notes } = requestBody

    // Initialize Supabase client with service_role to bypass RLS
    // This is secure because edge functions run server-side and validate all inputs
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Two-step workflow
    if (workflow === 'two-step') {

      // STEP 1: Barcode scan with storage location
      if (step === 1) {
        await dbLog(supabaseClient, 'info', 'Step 1: Processing barcode', { barcode, storage_location_id }, barcode)
        console.log('Step 1: Processing barcode:', barcode, 'Storage:', storage_location_id)

        // PRIORITY 1: Check product_catalog first (avoid API calls if cached)
        await dbLog(supabaseClient, 'debug', 'Checking product_catalog', null, barcode)
        console.log('Checking product_catalog for barcode:', barcode)
        const { data: catalogProduct, error: catalogError } = await supabaseClient
          .rpc('get_product_from_catalog', { p_barcode: barcode })
          .single()

        await dbLog(supabaseClient, 'debug', 'Catalog check complete', { found: !!catalogProduct, error: catalogError?.message }, barcode)

        let usdaData: any = null
        let upcitemdbData: any = null
        let openfoodfactsData: any = null
        let product: any = null
        let packageSize: number | null = null
        let packageUnit: string | null = null
        let sourcesPriority = 'api_fresh'

        // Multi-source nutrition data (for provenance tracking)
        let usdaNutrition: any = {}
        let offNutrition: any = {}
        let upcNutrition: any = {}

        if (catalogProduct && !catalogError) {
          await dbLog(supabaseClient, 'debug', 'Using cached product data', {
            has_usda: !!catalogProduct.usda_data,
            has_upcitemdb: !!catalogProduct.upcitemdb_data,
            has_openfoodfacts: !!catalogProduct.openfoodfacts_data
          }, barcode)
          console.log('✓ Found in product_catalog (cached), using stored data')
          usdaData = catalogProduct.usda_data
          upcitemdbData = catalogProduct.upcitemdb_data
          openfoodfactsData = catalogProduct.openfoodfacts_data

          // Try to extract product from cached data (priority: USDA > OpenFoodFacts > UPCitemdb)
          if (usdaData?.foods?.[0]) {
            product = extractUSDAProduct(usdaData.foods[0])
            usdaNutrition = extractUSDANutrition(usdaData.foods[0])
          } else if (openfoodfactsData?.product?.product_name) {
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
          console.log('✗ Not in catalog, calling APIs...')

          // PRIORITY 2: Call USDA FoodData Central API
          const usdaApiKey = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY'

          console.log('Trying USDA FoodData Central API...')
          try {
            const usdaResponse = await fetch(
              `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&dataType=Branded&pageSize=5&api_key=${usdaApiKey}`,
              {
                headers: {
                  'Accept': 'application/json',
                },
              }
            )

            if (usdaResponse.ok) {
              usdaData = await usdaResponse.json()

              // Filter results to match exact barcode (USDA search can return partial matches)
              const exactMatch = usdaData.foods?.find((food: any) =>
                food.gtinUpc === barcode
              )

              if (exactMatch) {
                await dbLog(supabaseClient, 'info', 'USDA found product', {
                  description: exactMatch.description,
                  fdcId: exactMatch.fdcId
                }, barcode)
                console.log('✓ USDA found product:', exactMatch.description)
                product = extractUSDAProduct(exactMatch)
                usdaNutrition = extractUSDANutrition(exactMatch)

                // Store just the matched food for catalog
                usdaData = { foods: [exactMatch] }
              } else {
                console.log('✗ USDA: No exact barcode match found')
                usdaData = null

                // NOTE: Fuzzy matching will be implemented later after we have product name from OFF/UPC
                // This is a placeholder for the fuzzy matching logic that will be called after
                // OFF and UPC APIs provide us with a product name to search by
              }
            } else {
              await dbLog(supabaseClient, 'info', 'USDA API failed', { status: usdaResponse.status }, barcode)
              console.log('✗ USDA API failed:', usdaResponse.status)
            }
          } catch (error) {
            console.error('USDA API error:', error)
            await dbLog(supabaseClient, 'error', 'USDA API exception', { error: error.message }, barcode)
          }

          // PRIORITY 3: Call UPCitemdb API for package size & pricing (also fallback for product data)
          console.log('Calling UPCitemdb API...')
          try {
            const upcitemdbResponse = await fetch(
              `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
              {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'MommaBsScanner/1.0',
                },
              }
            )

            if (upcitemdbResponse.ok) {
              upcitemdbData = await upcitemdbResponse.json()
              console.log('✓ UPCitemdb raw response:', JSON.stringify(upcitemdbData).substring(0, 300))
              const item = upcitemdbData?.items?.[0]

              if (item && (item.title || item.description)) {
                console.log('✓ UPCitemdb found product:', item.title || item.description)

                // If USDA didn't find product, use UPCitemdb data as fallback
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
            } else {
              console.log('✗ UPCitemdb API failed:', upcitemdbResponse.status)
            }
          } catch (error) {
            console.error('UPCitemdb API error:', error)
            // Continue without UPCitemdb data
          }

          // PRIORITY 4: Call Open Food Facts API for health scores & environmental data (also fallback)
          console.log('Calling Open Food Facts API...')
          try {
            const offResponse = await fetch(
              `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
              {
                headers: {
                  'User-Agent': 'MommaBsScanner/1.0 (nutritional tracking app)',
                },
              }
            )

            if (offResponse.ok) {
              openfoodfactsData = await offResponse.json()

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
            } else {
              console.log('✗ Open Food Facts API failed:', offResponse.status)
            }
          } catch (error) {
            console.error('Open Food Facts API error:', error)
            // Continue without Open Food Facts data
          }

          // Final check: Did we get product data from ANY source?
          await dbLog(supabaseClient, 'debug', 'Final check - product state', { has_product: !!product, product_value: product }, barcode)
          if (!product) {
            await dbLog(supabaseClient, 'error', 'Product not found in any API', { barcode }, barcode)
            console.error('✗ Product not found in any API (USDA, UPCitemdb, Open Food Facts)')
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
                usda: usdaData ? true : false,
                upcitemdb: upcitemdbData ? true : false,
                openfoodfacts: openfoodfactsData ? true : false,
              },
              p_product_name: product.food_name,
              p_brand_name: product.brand_name,
              p_nutritionix_data: null, // DEPRECATED
              p_upcitemdb_data: upcitemdbData,
              p_openfoodfacts_data: openfoodfactsData,
              p_usda_data: usdaData,
              p_usda_fdc_id: usdaData?.foods?.[0]?.fdcId || null,
            })

          if (catalogSaveError) {
            console.error('⚠️  Failed to save to product_catalog:', catalogSaveError)
            // Continue anyway - catalog is optional optimization
          } else {
            console.log('✓ Saved to product_catalog:', catalogSaveResult)
          }
        }

        // Select best nutrition values (USDA > OFF > UPC)
        const bestNutrition = selectBestNutrition(usdaNutrition, offNutrition, upcNutrition)

        // Extract Open Food Facts health/environmental data
        const offExtracted = extractOpenFoodFactsData(openfoodfactsData)

        // Create inventory item record in database with multi-source nutrition data
        const { data: inventoryItem, error: inventoryError } = await supabaseClient
          .from('inventory_items')
          .insert({
            barcode: barcode,
            storage_location_id: storage_location_id,
            household_id: '7c093e13-4bcf-463e-96c1-9f499de9c4f2', // TODO: Get from user context

            // Basic product info
            food_name: product.food_name,
            brand_name: product.brand_name,

            // Serving information
            serving_qty: product.serving_qty,
            serving_unit: product.serving_unit,
            serving_weight_grams: product.serving_weight_grams,

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
            usda_fdc_id: usdaData?.foods?.[0]?.fdcId || null,
            usda_raw_data: usdaData?.foods?.[0] || null,

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

            // Single Source of Truth (best values - displayed in UI)
            nf_calories: bestNutrition.nf_calories,
            nf_total_fat: bestNutrition.nf_total_fat,
            nf_saturated_fat: bestNutrition.nf_saturated_fat,
            nf_cholesterol: bestNutrition.nf_cholesterol,
            nf_sodium: bestNutrition.nf_sodium,
            nf_total_carbohydrate: bestNutrition.nf_total_carbohydrate,
            nf_dietary_fiber: bestNutrition.nf_dietary_fiber,
            nf_sugars: bestNutrition.nf_sugars,
            nf_protein: bestNutrition.nf_protein,
            nf_potassium: bestNutrition.nf_potassium,

            // Additional metadata (photos from USDA or OFF)
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
              usda: usdaData ? true : false,
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

        return new Response(
          JSON.stringify({
            success: true,
            item_id: inventoryItem.id,
            product: {
              name: product.food_name,
              brand: product.brand_name,
              serving_size: product.serving_qty,
              serving_unit: product.serving_unit,
              calories: bestNutrition.nf_calories,
              protein: bestNutrition.nf_protein,
              carbs: bestNutrition.nf_total_carbohydrate,
              fat: bestNutrition.nf_total_fat,
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
      await dbLog(supabaseClient, 'info', 'Manual entry', { product_name, storage_location_id }, null)
      console.log('Manual entry:', product_name, 'Storage:', storage_location_id)

      // Create inventory item with minimal data
      // Generate a unique barcode for manual entries (format: MANUAL-timestamp)
      const manualBarcode = barcode || `MANUAL-${Date.now()}`

      const { data: inventoryItem, error: inventoryError } = await supabaseClient
        .from('inventory_items')
        .insert({
          barcode: manualBarcode,
          storage_location_id: storage_location_id,
          household_id: '7c093e13-4bcf-463e-96c1-9f499de9c4f2', // TODO: Get from user context
          food_name: product_name,
          brand_name: brand_name || null,
          expiration_date: expiration_date,
          notes: notes || null,
          status: 'active',
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

      console.log('Manual entry complete, item_id:', inventoryItem.id)

      return new Response(
        JSON.stringify({
          success: true,
          scan_id: inventoryItem.id,
          item: inventoryItem,
        }),
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

// Extract product data from USDA FoodData Central response
function extractUSDAProduct(food: any) {
  return {
    food_name: food.description || food.lowercaseDescription || 'Unknown Product',
    brand_name: food.brandName || food.brandOwner || 'Unknown Brand',
    serving_qty: food.servingSize || null,
    serving_unit: food.servingSizeUnit || null,
    serving_weight_grams: food.servingSize || null, // USDA uses grams typically
    photo_thumb: null, // USDA doesn't provide photos
    photo_highres: null,
  }
}

// Extract nutrition data from USDA FoodData Central response
function extractUSDANutrition(food: any) {
  const nutrients: any = {}

  // USDA nutrients are in foodNutrients array
  if (food.foodNutrients && Array.isArray(food.foodNutrients)) {
    food.foodNutrients.forEach((nutrient: any) => {
      const name = nutrient.nutrientName || nutrient.nutrient?.name || ''
      const amount = nutrient.value || nutrient.amount || null

      // Map USDA nutrient names to our schema
      if (name.includes('Energy') || name.includes('Calories')) {
        nutrients.usda_calories = amount
      } else if (name.includes('Protein')) {
        nutrients.usda_protein = amount
      } else if (name.includes('Total lipid') || name.includes('Total Fat')) {
        nutrients.usda_total_fat = amount
      } else if (name.includes('Fatty acids, total saturated')) {
        nutrients.usda_saturated_fat = amount
      } else if (name.includes('Fatty acids, total trans')) {
        nutrients.usda_trans_fat = amount
      } else if (name.includes('Cholesterol')) {
        nutrients.usda_cholesterol = amount
      } else if (name.includes('Sodium')) {
        nutrients.usda_sodium = amount
      } else if (name.includes('Carbohydrate')) {
        nutrients.usda_total_carbohydrate = amount
      } else if (name.includes('Fiber')) {
        nutrients.usda_dietary_fiber = amount
      } else if (name.includes('Sugars, total')) {
        nutrients.usda_sugars = amount
      } else if (name.includes('Sugars, added')) {
        nutrients.usda_added_sugars = amount
      } else if (name.includes('Potassium')) {
        nutrients.usda_potassium = amount
      } else if (name.includes('Vitamin D')) {
        nutrients.usda_vitamin_d = amount
      } else if (name.includes('Calcium')) {
        nutrients.usda_calcium = amount
      } else if (name.includes('Iron')) {
        nutrients.usda_iron = amount
      }
    })
  }

  return nutrients
}

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

// Select nutrition values for display (nf_* fields)
// PHILOSOPHY: All API sources are equal - no hierarchy, no "better" source
// EXCEPTION: User input ALWAYS takes priority when present (user knows best)
// CURRENT STRATEGY: Use first available value (USER → USDA → OFF → UPC order)
//   - User input = highest priority (they looked at the label!)
//   - API order is NOT a quality hierarchy, just pragmatic "use what we got first"
//   - All source-specific values (user_*, usda_*, off_*, upc_*) are ALWAYS stored separately
// FUTURE: Will analyze real data (20-50 scans) to determine best selection logic:
//   - Average all available sources?
//   - Weighted average based on observed accuracy?
//   - Per-nutrient logic (e.g., government data for macros, community data for allergens)?
//   - User choice per item in Pantry app?
// THIS FUNCTION IS TEMPORARY - Easy to change once we have data to inform the decision
function selectBestNutrition(usdaNutrition: any, offNutrition: any, upcNutrition: any, userNutrition: any = {}) {
  return {
    nf_calories: userNutrition.user_calories ?? usdaNutrition.usda_calories ?? offNutrition.off_calories ?? upcNutrition.upc_calories ?? null,
    nf_protein: userNutrition.user_protein ?? usdaNutrition.usda_protein ?? offNutrition.off_protein ?? upcNutrition.upc_protein ?? null,
    nf_total_fat: userNutrition.user_total_fat ?? usdaNutrition.usda_total_fat ?? offNutrition.off_total_fat ?? upcNutrition.upc_total_fat ?? null,
    nf_saturated_fat: userNutrition.user_saturated_fat ?? usdaNutrition.usda_saturated_fat ?? offNutrition.off_saturated_fat ?? null,
    nf_cholesterol: userNutrition.user_cholesterol ?? usdaNutrition.usda_cholesterol ?? null, // OFF doesn't track cholesterol
    nf_sodium: userNutrition.user_sodium ?? usdaNutrition.usda_sodium ?? offNutrition.off_sodium ?? upcNutrition.upc_sodium ?? null,
    nf_total_carbohydrate: userNutrition.user_total_carbohydrate ?? usdaNutrition.usda_total_carbohydrate ?? offNutrition.off_total_carbohydrate ?? null,
    nf_dietary_fiber: userNutrition.user_dietary_fiber ?? usdaNutrition.usda_dietary_fiber ?? offNutrition.off_dietary_fiber ?? null,
    nf_sugars: userNutrition.user_sugars ?? usdaNutrition.usda_sugars ?? offNutrition.off_sugars ?? null,
    nf_potassium: userNutrition.user_potassium ?? usdaNutrition.usda_potassium ?? offNutrition.off_potassium ?? null,
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
