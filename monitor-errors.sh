#!/bin/bash
# Monitor Metro bundler and log errors to file

LOG_FILE="/Users/macmini/Desktop/Screenshots_and_Errors/metro-errors-$(date +%Y%m%d-%H%M%S).log"

echo "Monitoring Metro bundler output..."
echo "Error log: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""

# Start Metro and tee output to both console and log file
npx expo start --dev-client --clear 2>&1 | tee "$LOG_FILE" | grep -E "ERROR|WARN|Failed|Error:" --color=always
