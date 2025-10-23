-- Create a table to store edge function logs that we can query
CREATE TABLE IF NOT EXISTS edge_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  function_name TEXT NOT NULL,
  execution_id TEXT,
  log_level TEXT NOT NULL, -- 'info', 'error', 'debug'
  message TEXT NOT NULL,
  data JSONB,
  barcode TEXT
);

-- Index for quick lookups
CREATE INDEX idx_edge_function_logs_created_at ON edge_function_logs(created_at DESC);
CREATE INDEX idx_edge_function_logs_barcode ON edge_function_logs(barcode);
CREATE INDEX idx_edge_function_logs_function_name ON edge_function_logs(function_name);

-- Enable RLS
ALTER TABLE edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert
CREATE POLICY "Allow service role to insert logs" ON edge_function_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- Allow anon to read logs (for debugging)
CREATE POLICY "Allow anon to read logs" ON edge_function_logs
  FOR SELECT TO anon USING (true);
