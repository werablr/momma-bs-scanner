const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bwglyyfcdjzvvjdxxjmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2x5eWZjZGp6dnZqZHh4am1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzkzNTgsImV4cCI6MjA3NDY1NTM1OH0.J78VfLHx7JIB3UqROuPdonv-h-hG5seBaGO4gHMNc6M'
);

async function checkLogs() {
  const { data, error } = await supabase
    .from('edge_function_logs')
    .select('*')
    .eq('barcode', '0086395095005')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found', data.length, 'log entries:\n');
    data.forEach(log => {
      console.log(`[${log.created_at}] [${log.log_level}] ${log.message}`);
      if (log.data) console.log('  Data:', JSON.stringify(log.data, null, 2));
    });
  }
}

checkLogs();
