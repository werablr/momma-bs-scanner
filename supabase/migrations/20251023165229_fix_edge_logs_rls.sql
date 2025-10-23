-- Drop old policies
DROP POLICY IF EXISTS "Allow service role to insert logs" ON edge_function_logs;
DROP POLICY IF EXISTS "Allow anon to read logs" ON edge_function_logs;

-- Allow anyone to insert logs (this is internal debugging, not user data)
CREATE POLICY "Allow insert for all" ON edge_function_logs
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read logs  
CREATE POLICY "Allow read for all" ON edge_function_logs
  FOR SELECT USING (true);
