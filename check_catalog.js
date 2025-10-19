// Check product_catalog using service role key
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS
const supabase = createClient(
  'https://bwglyyfcdjzvvjdxxjmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2x5eWZjZGp6dnZqZHh4am1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzkzNTgsImV4cCI6MjA3NDY1NTM1OH0.J78VfLHx7JIB3UqROuPdonv-h-hG5seBaGO4gHMNc6M'
)

async function checkCatalog() {
  console.log('🔍 Checking product_catalog table...\n')

  const { data, error } = await supabase
    .from('product_catalog')
    .select('*')
    .limit(5)

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log(`✅ Found ${data.length} products in catalog:\n`)
    data.forEach((product, i) => {
      console.log(`${i + 1}. ${product.product_name} - ${product.brand_name}`)
      console.log(`   Barcode: ${product.barcode}`)
      console.log(`   Package: ${product.package_size} ${product.package_unit}`)
      console.log(`   Source: ${product.source_priority}`)
      console.log(`   Verified: ${product.verified_by_user}`)
      console.log(`   Last Seen: ${product.last_seen}`)
      console.log()
    })
  }
}

checkCatalog()
