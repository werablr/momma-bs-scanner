# Next Steps to Get Scanner Working

## Summary of Work Done

### ✅ Completed
1. **Analyzed architecture issues** - Documented UUID vs integer ID mismatch
2. **Added missing API methods** - `step1Barcode()`, `step2Expiration()`, `manualEntry()`, `getPendingStep2()` to `services/scannerAPI.js`
3. **Fixed BarcodeScanner.js** - Removed hardcoded integer IDs, added proper fallback handling
4. **Created SQL init script** - `scripts/init-storage-locations.sql`

### 📋 Remaining Steps

## Step 1: Create Storage Locations in Supabase (REQUIRED)

The app cannot save scanned items until storage locations exist in the database with proper UUIDs.

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Navigate to your project (URL: https://bwglyyfcdjzvvjdxxjmk.supabase.co)

2. **Find Your Household ID**
   - Go to **SQL Editor**
   - Run: `SELECT id, name FROM households;`
   - Copy the UUID for your household

3. **Run Initialization Script**
   - Open `scripts/init-storage-locations.sql`
   - Replace `YOUR_HOUSEHOLD_ID_HERE` with your actual household UUID (from step 2)
   - Copy the entire script
   - Paste into Supabase SQL Editor
   - Click "Run"

4. **Verify Creation**
   - You should see 6 rows created
   - Run: `SELECT * FROM storage_locations;`
   - Verify all 6 locations have UUID `id` fields

## Step 2: Reload the App on Your iPhone

After creating storage locations in the database:

1. **Shake your iPhone** to open the Developer Menu
2. **Tap "Reload"** to refresh the app
3. Watch the Metro bundler console for the new logs showing storage locations loaded

**Expected Console Output:**
```
✅ Storage locations loaded from database: [6 items with UUIDs]
```

## Step 3: Test Scanning

1. **Tap "Start New Scan"**
2. **Point camera at a barcode**
3. **Select storage location** (should show 6 locations from database)
4. **Capture expiration date** (or skip)
5. **Review and confirm**

## Current Issues

### Row Level Security (RLS)
If you see this error:
```
new row violates row-level security policy for table "storage_locations"
```

**Fix**: The app was trying to create locations but doesn't have permission. This is why we're using the SQL script instead (which runs with admin permissions).

### App Not Reloading
The console shows old code is still running. The app needs to reload to get the updated code.

**Fix**: Shake iPhone → Tap "Reload"

## Files Modified

### services/scannerAPI.js
- ✅ Added `step1Barcode(barcode, storageLocationId)`
- ✅ Added `step2Expiration(scanId, ocrText, extractedDate, confidence, processingTimeMs)`
- ✅ Added `manualEntry(productData)`
- ✅ Added `getPendingStep2()`

### components/BarcodeScanner.js
- ✅ Removed hardcoded integer IDs
- ✅ Added fallback locations with temp IDs for display
- ✅ Added warnings when database has no locations

### scripts/init-storage-locations.sql
- ✅ Created SQL script to initialize storage locations properly

### docs/storage-locations-architecture.md
- ✅ Documented all architecture issues and solutions

## Architecture Improvements for Future

Once scanner is working, consider:

1. **Remove `utils/constants.js` STORAGE_LOCATIONS** - Single source of truth should be database
2. **Add household_id awareness** - All storage location queries should filter by household
3. **Create admin UI** - Allow users to manage their own storage locations
4. **Add icons to database** - Store icons in `storage_locations` table instead of hardcoded

## Troubleshooting

### "No storage locations found"
- Run the SQL script in Supabase (Step 1 above)

### "Invalid UUID" errors
- Already fixed in latest code
- Make sure app has reloaded (shake phone → reload)

### Scanner not detecting barcodes
- Check camera permissions: Settings → MommaBsScanner → Camera
- Try a different barcode (UPC-A or EAN-13 work best)

### Edge function errors
- Check Supabase logs in dashboard
- Verify `scanner-ingest` edge function is deployed
