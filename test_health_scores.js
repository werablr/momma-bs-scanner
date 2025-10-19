// Check health scores from Open Food Facts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bwglyyfcdjzvvjdxxjmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2x5eWZjZGp6dnZqZHh4am1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzkzNTgsImV4cCI6MjA3NDY1NTM1OH0.J78VfLHx7JIB3UqROuPdonv-h-hG5seBaGO4gHMNc6M'
)

async function checkHealthScores() {
  console.log('🔍 Checking health scores from Open Food Facts...\n')

  const { data, error } = await supabase
    .from('inventory_items')
    .select('food_name, brand_name, nutriscore_grade, nova_group, ecoscore_grade, is_vegan, is_vegetarian, allergens, packaging_type, origins')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log(`✅ Found ${data.length} items with health data:\n`)
    data.forEach((item, i) => {
      console.log(`${i + 1}. ${item.food_name} - ${item.brand_name}`)
      console.log(`   Nutri-Score: ${item.nutriscore_grade || 'N/A'}`)
      console.log(`   NOVA Group: ${item.nova_group || 'N/A'}`)
      console.log(`   Eco-Score: ${item.ecoscore_grade || 'N/A'}`)
      console.log(`   Vegan: ${item.is_vegan !== null ? item.is_vegan : 'N/A'}`)
      console.log(`   Vegetarian: ${item.is_vegetarian !== null ? item.is_vegetarian : 'N/A'}`)
      console.log(`   Allergens: ${item.allergens || 'N/A'}`)
      console.log(`   Packaging: ${item.packaging_type || 'N/A'}`)
      console.log(`   Origin: ${item.origins || 'N/A'}`)
      console.log()
    })
  }
}

checkHealthScores()
