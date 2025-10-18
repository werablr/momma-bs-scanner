import TextRecognition from '@react-native-ml-kit/text-recognition';
import { extractExpirationDate } from '../utils/datePatternRecognition';

class OCRService {
  constructor() {
    this.isProcessing = false;
    this.maxRetries = 3;
  }

  async recognizeText(imageUri, options = {}) {
    if (this.isProcessing) {
      throw new Error('OCR is already processing an image');
    }

    this.isProcessing = true;

    try {
      console.log('🔍 Starting OCR recognition on:', imageUri);
      
      const result = await TextRecognition.recognize(imageUri);
      
      if (!result) {
        console.warn('⚠️ OCR returned null result');
        return {
          success: false,
          text: '',
          blocks: [],
          error: 'OCR service returned no result'
        };
      }

      if (!result.text || result.text.trim() === '') {
        console.warn('⚠️ OCR found no text in image');
        return {
          success: false,
          text: '',
          blocks: result.blocks || [],
          error: 'No text detected in image'
        };
      }

      console.log('✅ OCR text recognized:', result.text.substring(0, 100) + '...');
      console.log('📊 OCR blocks found:', result.blocks?.length || 0);
      console.log('📝 Full OCR text:', result.text);

      return {
        success: true,
        text: result.text,
        blocks: result.blocks || [],
        lines: result.lines || []
      };
    } catch (error) {
      console.error('❌ OCR recognition error:', error);
      
      // Handle specific ML Kit errors
      let errorMessage = error.message;
      if (error.message.includes('PERMISSION')) {
        errorMessage = 'Camera permission required for text recognition';
      } else if (error.message.includes('NETWORK')) {
        errorMessage = 'Network connection required for OCR processing';
      } else if (error.message.includes('INVALID_IMAGE')) {
        errorMessage = 'Invalid image format for text recognition';
      }
      
      return {
        success: false,
        text: '',
        blocks: [],
        error: errorMessage
      };
    } finally {
      this.isProcessing = false;
    }
  }

  async extractExpirationDate(imageUri, retryCount = 0) {
    const startTime = Date.now();
    
    try {
      const ocrResult = await this.recognizeText(imageUri);
      
      if (!ocrResult.success) {
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return this.extractExpirationDate(imageUri, retryCount + 1);
        }
        
        const processingTime = Date.now() - startTime;
        return {
          success: false,
          date: null,
          confidence: 0,
          rawText: null,
          ocrText: '',
          error: ocrResult.error,
          processingTimeMs: processingTime
        };
      }

      const expirationResult = extractExpirationDate(ocrResult.text);
      console.log(`📅 Initial extraction result:`, {
        date: expirationResult.date,
        confidence: expirationResult.confidence,
        rawText: expirationResult.rawText
      });

      // Try to find expiration date in individual blocks if main text didn't work well
      if (expirationResult.confidence < 0.7 && ocrResult.blocks.length > 0) {
        console.log(`🔍 Trying individual blocks (${ocrResult.blocks.length} blocks)`);
        const blockTexts = ocrResult.blocks.map(block => block.text);

        for (let i = 0; i < blockTexts.length; i++) {
          const blockText = blockTexts[i];
          console.log(`  Block ${i}: "${blockText}"`);
          const blockResult = extractExpirationDate(blockText);
          console.log(`  Block ${i} result:`, blockResult);

          if (blockResult.confidence > expirationResult.confidence) {
            expirationResult.date = blockResult.date;
            expirationResult.confidence = blockResult.confidence;
            expirationResult.rawText = blockResult.rawText;
            console.log(`  ✅ Better match found in block ${i}!`);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`🔍 OCR processing time: ${processingTime}ms`);
      console.log(`📊 Final OCR confidence: ${Math.round(expirationResult.confidence * 100)}%`);
      console.log(`📅 Final date: ${expirationResult.date}`);
      
      return {
        success: true,
        date: expirationResult.date,
        confidence: expirationResult.confidence,
        rawText: expirationResult.rawText,
        ocrText: ocrResult.text,
        error: null,
        processingTimeMs: processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OCR error after ${processingTime}ms:`, error);
      
      return {
        success: false,
        date: null,
        confidence: 0,
        rawText: null,
        ocrText: '',
        error: error.message,
        processingTimeMs: processingTime
      };
    }
  }

  preprocessImage(imageUri) {
    // This is a placeholder for future image preprocessing
    // Could include:
    // - Contrast enhancement
    // - Noise reduction
    // - Rotation correction
    // - Cropping to region of interest
    return imageUri;
  }

  async extractFromRegion(imageUri, region) {
    // Extract text from a specific region of the image
    // Useful when user has highlighted expiration date area
    const processedUri = this.preprocessImage(imageUri);
    return this.extractExpirationDate(processedUri);
  }

  validateDateResult(result) {
    if (!result || !result.date) {
      return false;
    }

    // Additional validation logic
    const date = new Date(result.date);
    const now = new Date();
    
    // Check if date is reasonable (not more than 5 years in future or past)
    const yearsDiff = Math.abs(date.getFullYear() - now.getFullYear());
    if (yearsDiff > 5) {
      return false;
    }

    // Check confidence threshold
    return result.confidence >= 0.7;
  }

  formatDateForDisplay(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
}

export default new OCRService();