#!/usr/bin/env node

/**
 * Database Status Checker
 * Checks the current state of the database tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable(tableName, columns = '*') {
  console.log(`\n📊 Checking ${tableName}...`);
  const { data, error, count } = await supabase
    .from(tableName)
    .select(columns, { count: 'exact' });

  if (error) {
    console.error(`❌ Error querying ${tableName}:`, error.message);
    if (error.code === '42P01') {
      console.error(`   Table "${tableName}" does not exist`);
    }
    return;
  }

  console.log(`✅ Found ${count || 0} rows in ${tableName}`);
  if (data && data.length > 0) {
    console.log('   Sample data:', JSON.stringify(data.slice(0, 3), null, 2));
  }
}

async function main() {
  console.log('🔍 Checking database status...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  // Check key tables
  await checkTable('households', 'id, name');
  await checkTable('users', 'id, household_id');
  await checkTable('storage_locations', 'id, household_id, name');
  await checkTable('scans', 'id, barcode, created_at');
  await checkTable('inventory_items', 'id, name, created_at');

  // Check auth users
  console.log('\n📊 Checking auth.users...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.log('❌ No authenticated user (expected - using anon key)');
  } else if (user) {
    console.log('✅ Authenticated user:', user.id);
  } else {
    console.log('ℹ️  No authenticated user session');
  }

  console.log('\n✅ Database check complete');
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
