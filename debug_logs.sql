-- Recent identify-by-photo logs
SELECT
  created_at,
  message,
  data
FROM edge_function_logs
WHERE function_name = 'identify-by-photo'
ORDER BY created_at DESC
LIMIT 15;
