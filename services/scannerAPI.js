import { supabase } from '../lib/supabase';

class ScannerAPI {

  // Barcode lookup via edge function
  async lookupBarcode(barcode) {
    try {
      console.log('🔍 Looking up barcode:', barcode);

      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: { upc: barcode }
      });

      if (error) {
        console.error('❌ Barcode lookup error:', error);
        throw error;
      }

      console.log('✅ Barcode lookup success:', data);
      return data;
    } catch (error) {
      console.error('❌ Barcode lookup failed:', error);
      throw error;
    }
  }

  // Add scanned item to inventory
  async addToInventory(itemData) {
    try {
      console.log('📝 Adding item to inventory:', itemData);

      const { data, error } = await supabase
        .from('inventory_items')
        .insert([itemData])
        .select();

      if (error) {
        console.error('❌ Failed to add item to inventory:', error);
        throw error;
      }

      console.log('✅ Item added to inventory:', data);
      return data[0];
    } catch (error) {
      console.error('❌ Add to inventory failed:', error);
      throw error;
    }
  }

  // Get storage locations
  async getStorageLocations(householdId) {
    try {
      console.log('📍 Fetching storage locations for household:', householdId);

      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', householdId);

      if (error) {
        console.error('❌ Failed to fetch storage locations:', error);
        throw error;
      }

      console.log('✅ Storage locations fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ Get storage locations failed:', error);
      throw error;
    }
  }

  // Create storage location
  async createStorageLocation(locationData) {
    try {
      console.log('📝 Creating storage location:', locationData);

      const { data, error } = await supabase
        .from('storage_locations')
        .insert([locationData])
        .select();

      if (error) {
        console.error('❌ Failed to create storage location:', error);
        throw error;
      }

      console.log('✅ Storage location created:', data);
      return data[0];
    } catch (error) {
      console.error('❌ Create storage location failed:', error);
      throw error;
    }
  }

  // Get inventory categories
  async getInventoryCategories(householdId) {
    try {
      console.log('📂 Fetching inventory categories for household:', householdId);

      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .eq('household_id', householdId);

      if (error) {
        console.error('❌ Failed to fetch inventory categories:', error);
        throw error;
      }

      console.log('✅ Inventory categories fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ Get inventory categories failed:', error);
      throw error;
    }
  }

  // Save scan to history
  async saveScanHistory(scanData) {
    try {
      console.log('📝 Saving scan to history:', scanData);

      const { data, error } = await supabase
        .from('scan_history')
        .insert([scanData])
        .select();

      if (error) {
        console.error('❌ Failed to save scan history:', error);
        throw error;
      }

      console.log('✅ Scan history saved:', data);
      return data[0];
    } catch (error) {
      console.error('❌ Save scan history failed:', error);
      throw error;
    }
  }

  // Get current user session
  async getCurrentUser() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Failed to get current user:', error);
        throw error;
      }

      return session?.user || null;
    } catch (error) {
      console.error('❌ Get current user failed:', error);
      throw error;
    }
  }

  // Get household for user
  async getUserHousehold(userId) {
    try {
      console.log('🏠 Fetching household for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .select(`
          household_id,
          households (
            id,
            name,
            settings
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch user household:', error);
        throw error;
      }

      console.log('✅ User household fetched:', data);
      return data.households;
    } catch (error) {
      console.error('❌ Get user household failed:', error);
      throw error;
    }
  }

  // Two-step workflow methods

  // Step 1: Submit barcode with storage location
  async step1Barcode(barcode, storageLocationId) {
    try {
      console.log('📝 Step 1: Submitting barcode:', { barcode, storageLocationId });

      const response = await supabase.functions.invoke('scanner-ingest', {
        body: {
          workflow: 'two-step',
          step: 1,
          barcode,
          storage_location_id: storageLocationId
        }
      });

      console.log('🔍 RAW RESPONSE:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.error('❌ Step 1 failed:', response.error);
        console.error('❌ Error details:', {
          message: response.error.message,
          status: response.error.status,
          statusText: response.error.statusText,
          context: response.error.context
        });
        return { success: false, error: response.error.message || 'Step 1 failed' };
      }

      // Check if the edge function returned success: false (e.g., product not found)
      if (response.data && !response.data.success) {
        console.error('❌ Product not found:', response.data.error);
        return {
          success: false,
          error: response.data.error || 'Product not found',
          barcode: response.data.barcode
        };
      }

      console.log('✅ Step 1 success:', response.data);
      return {
        success: true,
        scan_id: response.data.scan_id,
        product: response.data.product,
        suggested_category: response.data.suggested_category,
        confidence_score: response.data.confidence_score
      };
    } catch (error) {
      console.error('❌ Step 1 exception:', error);
      console.error('❌ Exception details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message || 'Step 1 failed' };
    }
  }

  // Step 2: Submit expiration date via OCR
  async step2Expiration(scanId, ocrText, extractedDate, confidence, processingTimeMs) {
    try {
      console.log('📝 Step 2: Submitting expiration data:', {
        scanId,
        ocrText,
        extractedDate,
        confidence,
        processingTimeMs
      });

      const { data, error } = await supabase.functions.invoke('scanner-ingest', {
        body: {
          workflow: 'two-step',
          step: 2,
          scan_id: scanId,
          ocr_text: ocrText,
          extracted_date: extractedDate,
          ocr_confidence: confidence,
          ocr_processing_time_ms: processingTimeMs
        }
      });

      if (error) {
        console.error('❌ Step 2 failed:', error);
        return { success: false, error: error.message || 'Step 2 failed' };
      }

      console.log('✅ Step 2 success:', data);
      return {
        success: true,
        ocr_results: data.ocr_results
      };
    } catch (error) {
      console.error('❌ Step 2 exception:', error);
      return { success: false, error: error.message || 'Step 2 failed' };
    }
  }

  // Submit manual entry
  async manualEntry(productData) {
    try {
      console.log('📝 Manual entry:', productData);

      const { data, error } = await supabase.functions.invoke('scanner-ingest', {
        body: {
          workflow: 'manual',
          ...productData
        }
      });

      if (error) {
        console.error('❌ Manual entry failed:', error);
        return { success: false, error: error.message || 'Manual entry failed' };
      }

      console.log('✅ Manual entry success:', data);
      return {
        success: true,
        scan_id: data.scan_id
      };
    } catch (error) {
      console.error('❌ Manual entry exception:', error);
      return { success: false, error: error.message || 'Manual entry failed' };
    }
  }

  // Get pending step 2 scans (scans that completed step 1 but not step 2)
  async getPendingStep2() {
    try {
      console.log('📋 Fetching pending step 2 scans');

      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('workflow_step', 1)
        .is('expiration_date', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch pending scans:', error);
        throw error;
      }

      console.log('✅ Pending scans fetched:', data);
      return { success: true, scans: data };
    } catch (error) {
      console.error('❌ Get pending scans exception:', error);
      return { success: false, error: error.message, scans: [] };
    }
  }

}

export default new ScannerAPI();