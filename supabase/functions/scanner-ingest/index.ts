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
        await dbLog(supabaseClient, 'info', 'Step 1: Processing barcode', { barcode, storage_location_id }, barcode)
        console.log('Step 1: Processing barcode:', barcode, 'Storage:', storage_location_id)

        // PRIORITY 1: Check product_catalog first (avoid API calls if cached)
        await dbLog(supabaseClient, 'debug', 'Checking product_catalog', null, barcode)
        console.log('Checking product_catalog for barcode:', barcode)
        const { data: catalogProduct, error: catalogError } = await supabaseClient
          .rpc('get_product_from_catalog', { p_barcode: barcode })
          .single()

        await dbLog(supabaseClient, 'debug', 'Catalog check complete', { found: !!catalogProduct, error: catalogError?.message }, barcode)

        let nutritionixData: any = null
        let upcitemdbData: any = null
        let openfoodfactsData: any = null
        let product: any = null
        let packageSize: number | null = null
        let packageUnit: string | null = null
        let sourcesPriority = 'api_fresh'

        if (catalogProduct && !catalogError) {
          await dbLog(supabaseClient, 'debug', 'Using cached product data', { has_nutritionix: !!catalogProduct.nutritionix_data, has_upcitemdb: !!catalogProduct.upcitemdb_data, has_openfoodfacts: !!catalogProduct.openfoodfacts_data }, barcode)
          console.log('✓ Found in product_catalog (cached), using stored data')
          nutritionixData = catalogProduct.nutritionix_data
          upcitemdbData = catalogProduct.upcitemdb_data
          openfoodfactsData = catalogProduct.openfoodfacts_data

          // Try to extract product from cached data (priority: Nutritionix > UPCitemdb > OpenFoodFacts)
          if (nutritionixData?.foods?.[0]) {
            product = nutritionixData.foods[0]
          } else if (upcitemdbData?.items?.[0]) {
            // Reconstruct product from UPCitemdb data
            const item = upcitemdbData.items[0]
            product = {
              food_name: item.title || item.description || 'Unknown Product',
              brand_name: item.brand || 'Unknown Brand',
              serving_qty: null,
              serving_unit: null,
              serving_weight_grams: null,
              nf_calories: null,
              nf_total_fat: null,
              nf_saturated_fat: null,
              nf_cholesterol: null,
              nf_sodium: null,
              nf_total_carbohydrate: null,
              nf_dietary_fiber: null,
              nf_sugars: null,
              nf_protein: null,
              nf_potassium: null,
            }
          } else if (openfoodfactsData?.product?.product_name) {
            // Reconstruct product from OpenFoodFacts data
            const offProduct = openfoodfactsData.product
            product = {
              food_name: offProduct.product_name,
              brand_name: offProduct.brands || 'Unknown Brand',
              serving_qty: offProduct.serving_quantity ? parseFloat(offProduct.serving_quantity) : null,
              serving_unit: offProduct.serving_quantity_unit || null,
              serving_weight_grams: offProduct.serving_size ? parseFloat(offProduct.serving_size) : null,
              nf_calories: offProduct.nutriments?.['energy-kcal_100g'] || null,
              nf_total_fat: offProduct.nutriments?.fat_100g || null,
              nf_saturated_fat: offProduct.nutriments?.['saturated-fat_100g'] || null,
              nf_cholesterol: null,
              nf_sodium: offProduct.nutriments?.sodium_100g ? offProduct.nutriments.sodium_100g * 1000 : null,
              nf_total_carbohydrate: offProduct.nutriments?.carbohydrates_100g || null,
              nf_dietary_fiber: offProduct.nutriments?.fiber_100g || null,
              nf_sugars: offProduct.nutriments?.sugars_100g || null,
              nf_protein: offProduct.nutriments?.proteins_100g || null,
              nf_potassium: null,
            }
          }

          await dbLog(supabaseClient, 'debug', 'Extracted product from cache', { has_product: !!product, product_name: product?.food_name }, barcode)
          packageSize = catalogProduct.package_size
          packageUnit = catalogProduct.package_unit
          sourcesPriority = 'catalog_cached'
        } else {
          console.log('✗ Not in catalog, calling APIs...')

          // PRIORITY 2: Call Nutritionix API
          const nutritionixAppId = Deno.env.get('NUTRITIONIX_APP_ID')
          const nutritionixApiKey = Deno.env.get('NUTRITIONIX_API_KEY')

          if (!nutritionixAppId || !nutritionixApiKey) {
            throw new Error('Nutritionix API credentials not configured')
          }

          console.log('Trying Nutritionix API...')
          const nutritionixResponse = await fetch(
            `https://trackapi.nutritionix.com/v2/search/item?upc=${barcode}`,
            {
              headers: {
                'x-app-id': nutritionixAppId,
                'x-app-key': nutritionixApiKey,
              },
            }
          )

          if (nutritionixResponse.ok) {
            nutritionixData = await nutritionixResponse.json()
            product = nutritionixData.foods?.[0]
            if (product) {
              await dbLog(supabaseClient, 'info', 'Nutritionix found product', { food_name: product.food_name }, barcode)
              console.log('✓ Nutritionix found product:', product.food_name)
            }
          } else {
            await dbLog(supabaseClient, 'info', 'Nutritionix failed, trying fallback APIs', { status: nutritionixResponse.status }, barcode)
            console.log('✗ Nutritionix failed, will try other APIs')
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

                // If Nutritionix didn't find product, use UPCitemdb data as fallback
                if (!product) {
                  await dbLog(supabaseClient, 'info', 'Using UPCitemdb as fallback product source', { title: item.title }, barcode)
                  console.log('→ Using UPCitemdb as primary product source')
                  product = {
                    food_name: item.title || item.description || 'Unknown Product',
                    brand_name: item.brand || 'Unknown Brand',
                    // UPCitemdb doesn't have nutrition data, set to null
                    serving_qty: null,
                    serving_unit: null,
                    serving_weight_grams: null,
                    nf_calories: null,
                    nf_total_fat: null,
                    nf_saturated_fat: null,
                    nf_cholesterol: null,
                    nf_sodium: null,
                    nf_total_carbohydrate: null,
                    nf_dietary_fiber: null,
                    nf_sugars: null,
                    nf_protein: null,
                    nf_potassium: null,
                  }
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

                // If still no product data, use Open Food Facts as final fallback
                if (!product && offProduct.product_name) {
                  console.log('→ Using Open Food Facts as primary product source')
                  product = {
                    food_name: offProduct.product_name,
                    brand_name: offProduct.brands || 'Unknown Brand',
                    // Try to get serving info from OFF
                    serving_qty: offProduct.serving_quantity ? parseFloat(offProduct.serving_quantity) : null,
                    serving_unit: offProduct.serving_quantity_unit || null,
                    serving_weight_grams: offProduct.serving_size ? parseFloat(offProduct.serving_size) : null,
                    // Try to get nutrition from OFF (per 100g)
                    nf_calories: offProduct.nutriments?.['energy-kcal_100g'] || null,
                    nf_total_fat: offProduct.nutriments?.fat_100g || null,
                    nf_saturated_fat: offProduct.nutriments?.['saturated-fat_100g'] || null,
                    nf_cholesterol: null, // OFF doesn't track cholesterol
                    nf_sodium: offProduct.nutriments?.sodium_100g ? offProduct.nutriments.sodium_100g * 1000 : null, // Convert g to mg
                    nf_total_carbohydrate: offProduct.nutriments?.carbohydrates_100g || null,
                    nf_dietary_fiber: offProduct.nutriments?.fiber_100g || null,
                    nf_sugars: offProduct.nutriments?.sugars_100g || null,
                    nf_protein: offProduct.nutriments?.proteins_100g || null,
                    nf_potassium: null, // OFF doesn't track potassium
                  }
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
            console.error('✗ Product not found in any API (Nutritionix, UPCitemdb, Open Food Facts)')
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

          // Save to product_catalog for future scans (only if product exists)
          console.log('Saving to product_catalog...')
          const { data: catalogSaveResult, error: catalogSaveError } = await supabaseClient
            .rpc('upsert_product_catalog', {
              p_barcode: barcode,
              p_package_size: packageSize,
              p_package_unit: packageUnit,
              p_verified_by_user: false,
              p_source_priority: packageSize ? 'title_parsed' : 'none',
              p_data_sources: {
                nutritionix: true,
                upcitemdb: upcitemdbData ? true : false,
                openfoodfacts: openfoodfactsData ? true : false,
              },
              p_product_name: product.food_name,
              p_brand_name: product.brand_name,
              p_nutritionix_data: nutritionixData,
              p_upcitemdb_data: upcitemdbData,
              p_openfoodfacts_data: openfoodfactsData,
            })

          if (catalogSaveError) {
            console.error('⚠️  Failed to save to product_catalog:', catalogSaveError)
            // Continue anyway - catalog is optional optimization
          } else {
            console.log('✓ Saved to product_catalog:', catalogSaveResult)
          }
        }

        // Extract Open Food Facts data
        const offExtracted = extractOpenFoodFactsData(openfoodfactsData)

        // Create inventory item record in database with full Nutritionix + UPCitemdb + Open Food Facts data
        const { data: inventoryItem, error: inventoryError } = await supabaseClient
          .from('inventory_items')
          .insert({
            barcode: barcode,
            storage_location_id: storage_location_id,
            household_id: '7c093e13-4bcf-463e-96c1-9f499de9c4f2', // TODO: Get from user context

            // Basic product info
            food_name: product.food_name,
            brand_name: product.brand_name,
            nix_brand_id: product.nix_brand_id,
            nix_item_id: product.nix_item_id,

            // Serving information
            serving_qty: product.serving_qty,
            serving_unit: product.serving_unit,
            serving_weight_grams: product.serving_weight_grams,

            // Nutrition facts
            nf_calories: product.nf_calories,
            nf_total_fat: product.nf_total_fat,
            nf_saturated_fat: product.nf_saturated_fat,
            nf_cholesterol: product.nf_cholesterol,
            nf_sodium: product.nf_sodium,
            nf_total_carbohydrate: product.nf_total_carbohydrate,
            nf_dietary_fiber: product.nf_dietary_fiber,
            nf_sugars: product.nf_sugars,
            nf_protein: product.nf_protein,
            nf_potassium: product.nf_potassium,

            // Additional metadata
            photo_thumb: product.photo?.thumb,
            photo_highres: product.photo?.highres,
            ndb_no: product.ndb_no,
            source: product.source,
            full_nutrients: product.full_nutrients,
            alt_measures: product.alt_measures,
            tags: product.tags,

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
              nutritionix: true,
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
      const { data: inventoryItem, error: inventoryError } = await supabaseClient
        .from('inventory_items')
        .insert({
          barcode: barcode || null,
          storage_location_id: storage_location_id,
          household_id: '7c093e13-4bcf-463e-96c1-9f499de9c4f2', // TODO: Get from user context
          food_name: product_name,
          brand_name: brand_name || null,
          expiration_date: expiration_date,
          notes: notes || null,
          status: 'active',
        })
        .select()
        .single()

      if (inventoryError) {
        console.error('Manual entry database error:', inventoryError)
        throw inventoryError
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

// Helper function to categorize product based on nutritional data
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

  return {
    // Health scores
    nutriscore_grade: nutriscoreGrade,
    nova_group: p.nova_group ? parseInt(p.nova_group) : null,
    ecoscore_grade: p.ecoscore_grade || null,
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
