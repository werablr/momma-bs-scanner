import scannerAPI from '../services/scannerAPI';

export const testTwoStepWorkflow = async () => {
  console.log('🧪 Testing Two-Step Scanner Workflow');
  
  try {
    // Test 1: Get pending step 2 scans
    console.log('\n📋 Step 1: Getting pending step 2 scans...');
    const pendingResult = await scannerAPI.getPendingStep2();
    console.log('✅ Pending scans:', pendingResult);

    // Test 2: Complete step 2 for scan ID 100 (if it exists)
    if (pendingResult.scans && pendingResult.scans.length > 0) {
      const pendingScan = pendingResult.scans[0];
      console.log(`\n📅 Step 2: Completing expiration scan for scan ID ${pendingScan.id}...`);
      
      const step2Result = await scannerAPI.step2Expiration(
        pendingScan.id,
        'Best By 12/25/2025',
        '2025-12-25',
        0.89
      );
      console.log('✅ Step 2 complete:', step2Result);
    } else {
      console.log('ℹ️ No pending scans found');
    }

    // Test 3: Test new barcode scan (step 1)
    console.log('\n🔍 Step 3: Testing new barcode scan...');
    const step1Result = await scannerAPI.step1Barcode('123456789012', 3);
    console.log('✅ Step 1 complete:', step1Result);

    // Test 4: Test manual entry
    console.log('\n✏️ Step 4: Testing manual entry...');
    const manualResult = await scannerAPI.manualEntry({
      product_name: 'Test Product',
      brand_name: 'Test Brand',
      storage_location_id: 3,
      expiration_date: '2025-12-31',
      notes: 'Test manual entry'
    });
    console.log('✅ Manual entry complete:', manualResult);

    console.log('\n🎉 Two-step workflow test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Two-step workflow test failed:', error);
    return false;
  }
};

export const logWorkflowInfo = () => {
  console.log(`
🎯 Two-Step Scanner Workflow Summary:

📱 Step 1: Barcode Scan
- User scans barcode
- API call: scannerAPI.step1Barcode(barcode, storageLocationId)
- Response: { success: true, scan_id: X, product: {...} }
- UI automatically transitions to Step 2

📅 Step 2: Expiration Date
- User captures expiration date with OCR
- API call: scannerAPI.step2Expiration(scanId, ocrText, date, confidence)
- Response: { success: true, status: 'ready_for_review' }
- UI shows review screen with complete data

✏️ Manual Entry Alternative:
- User fills manual form
- API call: scannerAPI.manualEntry(productData)
- Response: { success: true, scan_id: X }
- Bypasses both scanning steps

🔄 Workflow States:
- Step 1 complete → pending_expiration_scan
- Step 2 complete → ready_for_review
- Manual entry → ready_for_review

🧪 Test with scan ID 100 (Campbell's Soup):
- Currently in pending_expiration_scan state
- Ready for step 2 testing
  `);
};