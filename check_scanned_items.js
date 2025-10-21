import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwglyyfcdjzvvjdxxjmk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2x5eWZjZGp6dnZqZHh4am1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzkzNTgsImV4cCI6MjA3NDY1NTM1OH0.J78VfLHx7JIB3UqROuPdonv-h-hG5seBaGO4gHMNc6M';
const householdId = '7c093e13-4bcf-463e-96c1-9f499de9c4f2';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScannedItems() {
  console.log('🔍 Checking scanned items in database...\n');

  // Get all inventory items
  const { data: items, error } = await supabase
    .from('inventory_items')
    .select(`
      id,
      food_name,
      brand_name,
      barcode,
      scanned_at,
      storage_locations(name),
      expiration_date,
      package_size,
      package_unit,
      nutriscore_grade,
      nova_group
    `)
    .eq('household_id', householdId)
    .order('scanned_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching items:', error);
    return;
  }

  console.log(`✅ Total items scanned: ${items.length}\n`);
  console.log('=' .repeat(80));

  // Group by storage location
  const byLocation = {};
  items.forEach(item => {
    const location = item.storage_locations?.name || 'Unknown';
    if (!byLocation[location]) byLocation[location] = [];
    byLocation[location].push(item);
  });

  // Display summary by location
  console.log('\n📊 BY STORAGE LOCATION:');
  Object.entries(byLocation).forEach(([location, locationItems]) => {
    console.log(`\n${location}: ${locationItems.length} items`);
  });

  // Display all items
  console.log('\n\n📋 ALL SCANNED ITEMS:');
  console.log('=' .repeat(80));

  items.forEach((item, index) => {
    const location = item.storage_locations?.name || 'Unknown';
    const packageInfo = item.package_size && item.package_unit
      ? `${item.package_size} ${item.package_unit}`
      : 'No package info';
    const healthScore = item.nutriscore_grade
      ? `Nutri-Score: ${item.nutriscore_grade.toUpperCase()}`
      : 'No health score';
    const scanDate = new Date(item.scanned_at).toLocaleDateString();

    console.log(`\n${index + 1}. ${item.food_name || 'Unknown'}`);
    console.log(`   Brand: ${item.brand_name || 'Unknown'}`);
    console.log(`   Location: ${location}`);
    console.log(`   Package: ${packageInfo}`);
    console.log(`   ${healthScore}`);
    console.log(`   Scanned: ${scanDate}`);
    console.log(`   Barcode: ${item.barcode}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ Testing Progress: ${items.length}/50 items scanned`);
  console.log(`📍 Unique locations used: ${Object.keys(byLocation).length}`);

  // Data quality check
  const withPackageSize = items.filter(i => i.package_size).length;
  const withHealthScore = items.filter(i => i.nutriscore_grade).length;

  console.log(`\n📈 DATA QUALITY:`);
  console.log(`   Package size captured: ${withPackageSize}/${items.length} (${Math.round(withPackageSize/items.length*100)}%)`);
  console.log(`   Health scores captured: ${withHealthScore}/${items.length} (${Math.round(withHealthScore/items.length*100)}%)`);
}

checkScannedItems();
