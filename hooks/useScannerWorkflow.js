import { useState, useCallback } from 'react';
import scannerAPI from '../services/scannerAPI';

export const useScannerWorkflow = () => {
  const [workflowState, setWorkflowState] = useState({
    step: null, // null, 1, or 2
    scanId: null,
    barcode: null,
    productData: null,
    storageLocationId: null,
    expirationData: null,
    isLoading: false,
    error: null
  });

  const resetWorkflow = useCallback(() => {
    setWorkflowState({
      step: null,
      scanId: null,
      barcode: null,
      productData: null,
      storageLocationId: null,
      expirationData: null,
      isLoading: false,
      error: null
    });
  }, []);

  const startStep1 = useCallback(async (barcode, storageLocationId) => {
    setWorkflowState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await scannerAPI.step1Barcode(barcode, storageLocationId);
      
      if (result.success) {
        setWorkflowState(prev => ({
          ...prev,
          step: 1,
          scanId: result.scan_id,
          barcode,
          productData: result.product,
          storageLocationId,
          isLoading: false
        }));
        return { success: true, scanId: result.scan_id };
      } else {
        throw new Error(result.error || 'Step 1 failed');
      }
    } catch (error) {
      setWorkflowState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      return { success: false, error: error.message };
    }
  }, []);

  const completeStep2 = useCallback(async (expirationData) => {
    if (!workflowState.scanId) {
      return { success: false, error: 'No scan ID available' };
    }

    setWorkflowState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await scannerAPI.step2Expiration(
        workflowState.scanId,
        expirationData.ocrText || '',
        expirationData.date,
        expirationData.confidence || 0
      );
      
      if (result.success) {
        setWorkflowState(prev => ({
          ...prev,
          step: 2,
          expirationData,
          isLoading: false
        }));
        return { success: true };
      } else {
        throw new Error(result.error || 'Step 2 failed');
      }
    } catch (error) {
      setWorkflowState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      return { success: false, error: error.message };
    }
  }, [workflowState.scanId]);

  const submitManualEntry = useCallback(async (productData) => {
    setWorkflowState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await scannerAPI.manualEntry(productData);
      
      if (result.success) {
        return { success: true, scanId: result.scan_id };
      } else {
        throw new Error(result.error || 'Manual entry failed');
      }
    } catch (error) {
      setWorkflowState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      return { success: false, error: error.message };
    }
  }, []);

  const getPendingScans = useCallback(async () => {
    try {
      const result = await scannerAPI.getPendingStep2();
      return result.scans || [];
    } catch (error) {
      console.error('Failed to get pending scans:', error);
      return [];
    }
  }, []);

  return {
    workflowState,
    resetWorkflow,
    startStep1,
    completeStep2,
    submitManualEntry,
    getPendingScans
  };
};