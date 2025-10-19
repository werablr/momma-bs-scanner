// Test UPCitemdb integration with product_catalog caching
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bwglyyfcdjzvvjdxxjmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2x5eWZjZGp6dnZqZHh4am1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzkzNTgsImV4cCI6MjA3NDY1NTM1OH0.J78VfLHx7JIB3UqROuPdonv-h-hG5seBaGO4gHMNc6M'
)

async function testUPCitemdbIntegration() {
  console.log('🧪 Testing UPCitemdb Integration\n')
  console.log('=' .repeat(60))

  // Bush's Reduced Sodium Black Beans - 15 oz can
  const testBarcode = '0039400018834'
  const storageLocationId = '05d891b0-66c1-48f0-adbc-a0d8288a0ca8' // Pantry

  console.log('\n📊 Test Barcode:', testBarcode)
  console.log('📦 Expected: Package size data from UPCitemdb\n')

  // Call scanner-ingest edge function
  const { data, error } = await supabase.functions.invoke('scanner-ingest', {
    body: {
      workflow: 'two-step',
      step: 1,
      barcode: testBarcode,
      storage_location_id: storageLocationId,
    },
  })

  if (error) {
    console.error('❌ Edge function error:', error)
    return
  }

  console.log('✅ Step 1 Response:')
  console.log(JSON.stringify(data, null, 2))

  if (!data.success) {
    console.error('\n❌ API call failed:', data.error)
    return
  }

  // Check product_catalog for cached data
  console.log('\n🔍 Checking product_catalog...')
  const { data: catalogData, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('barcode', testBarcode)
    .single()

  if (catalogError) {
    console.error('❌ Catalog lookup error:', catalogError)
  } else {
    console.log('✅ Product Catalog Entry:')
    console.log('  Barcode:', catalogData.barcode)
    console.log('  Product:', catalogData.product_name)
    console.log('  Brand:', catalogData.brand_name)
    console.log('  Package Size:', catalogData.package_size, catalogData.package_unit)
    console.log('  Source Priority:', catalogData.source_priority)
    console.log('  Data Sources:', JSON.stringify(catalogData.data_sources))
    console.log('  Verified by User:', catalogData.verified_by_user)
    console.log('  Last Seen:', catalogData.last_seen)
  }

  // Check inventory_items
  console.log('\n📦 Checking inventory_items...')
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('inventory_items')
    .select('id, food_name, brand_name, package_size, package_unit, data_sources, status')
    .eq('barcode', testBarcode)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (inventoryError) {
    console.error('❌ Inventory lookup error:', inventoryError)
  } else {
    console.log('✅ Inventory Item:')
    console.log('  ID:', inventoryData.id)
    console.log('  Product:', inventoryData.food_name, '-', inventoryData.brand_name)
    console.log('  Package Size:', inventoryData.package_size, inventoryData.package_unit)
    console.log('  Data Sources:', JSON.stringify(inventoryData.data_sources))
    console.log('  Status:', inventoryData.status)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Test Complete!')
  console.log('\n💡 Next: Scan again to test catalog caching (should be instant)')
}

testUPCitemdbIntegration()
