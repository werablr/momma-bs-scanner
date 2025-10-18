#!/usr/bin/env node

/**
 * Check current RLS policies on storage_locations
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

async function main() {
  console.log('🔍 Checking RLS Status\n');

  // Query to check RLS policies
  const checkPoliciesSQL = `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual::text as using_expression,
      with_check::text as with_check_expression
    FROM pg_policies
    WHERE tablename = 'storage_locations'
    ORDER BY policyname;
  `;

  console.log('📋 Current RLS policies on storage_locations:\n');

  try {
    // Try to query pg_policies (this might not work with anon key)
    const { data, error } = await supabase
      .rpc('exec_sql', { sql: checkPoliciesSQL });

    if (error) {
      console.log('⚠️  Cannot query pg_policies with anon key (expected)\n');
    } else {
      console.log(data);
    }
  } catch (err) {
    console.log('⚠️  Cannot query system tables with anon key\n');
  }

  // Test actual query
  console.log('🧪 Testing actual storage_locations query...\n');

  const { data, error, count } = await supabase
    .from('storage_locations')
    .select('id, household_id, name, type, icon', { count: 'exact' });

  console.log('Query result:');
  console.log(`  Count: ${count}`);
  console.log(`  Error: ${error ? error.message : 'None'}`);
  console.log(`  Data rows: ${data ? data.length : 0}\n`);

  if (data && data.length > 0) {
    console.log('📍 Visible storage locations:');
    data.forEach(loc => {
      console.log(`   ${loc.icon || '📦'} ${loc.name} (household: ${loc.household_id})`);
    });
  } else {
    console.log('⚠️  No storage locations visible to anonymous user');
    console.log('\n🔍 Possible reasons:');
    console.log('   1. RLS policy exists but filters by household_id');
    console.log('   2. RLS policy requires authentication');
    console.log('   3. No "USING (true)" policy for anonymous SELECT\n');

    console.log('💡 To fix, run this in Supabase SQL Editor:\n');
    console.log('```sql');
    console.log(`-- Drop existing restrictive anonymous policy if any`);
    console.log(`DROP POLICY IF EXISTS "Allow anonymous read access to storage_locations" ON storage_locations;`);
    console.log('');
    console.log(`-- Create permissive anonymous read policy`);
    console.log(`CREATE POLICY "Allow anonymous read access to storage_locations"`);
    console.log(`ON storage_locations`);
    console.log(`FOR SELECT`);
    console.log(`TO anon`);
    console.log(`USING (true);`);
    console.log('```\n');
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
