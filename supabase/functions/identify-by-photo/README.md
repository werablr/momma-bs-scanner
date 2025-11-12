# identify-by-photo Edge Function

## Purpose
AI-powered food identification for produce and bulk items without barcodes using OpenAI GPT-4 Vision.

## Workflow
1. User takes photo of food item
2. Photo uploaded to Supabase Storage (`user-food-photos` bucket)
3. Edge function receives photo URL
4. OpenAI GPT-4 Vision identifies the item
5. Search Open Food Facts by AI-identified name
6. Return top 5 matches with photos and nutrition data
7. User selects correct match in mobile app

## Request Format
```json
{
  "photo_url": "https://bwglyyfcdjzvvjdxxjmk.supabase.co/storage/v1/object/public/user-food-photos/...",
  "household_id": "7c093e13-4bcf-463e-96c1-9f499de9c4f2",
  "storage_location_id": "05d891b0-66c1-48f0-adbc-a0d8288a0ca8"
}
```

## Response Format
```json
{
  "success": true,
  "ai_identification": {
    "name": "Fuji Apple",
    "confidence": 0.95,
    "category": "produce",
    "reasoning": "Red and yellow striped apple with characteristic Fuji appearance"
  },
  "off_matches": [
    {
      "product_name": "Apple, Fuji",
      "brands": "Fresh Produce",
      "image_url": "https://...",
      "image_thumb_url": "https://...",
      "nutriscore_grade": "a",
      "nova_group": 1,
      "categories": "Fresh fruits, Apples",
      "quantity": "1 apple",
      "nutrition": {
        "energy_kcal": 52,
        "proteins": 0.3,
        "carbohydrates": 13.8,
        "fat": 0.2,
        "fiber": 2.4,
        "sugars": 10.4,
        "sodium": 0.001
      },
      "vegetarian": 1,
      "vegan": 1,
      "match_score": 150
    }
  ],
  "total_matches": 12,
  "photo_url": "https://..."
}
```

## Environment Variables Required
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `OPENAI_API_KEY` - OpenAI API key for GPT-4 Vision

## Deployment
```bash
cd /Users/macmini/Desktop/momma-bs-scanner
supabase functions deploy identify-by-photo
```

## Set OpenAI API Key
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## Cost Estimate
**OpenAI GPT-4 Vision:**
- $0.01 per image (low resolution)
- $0.03 per image (high resolution)
- Expected usage: 10-20 produce items/week = $2-6/month

**Open Food Facts API:**
- Free, unlimited

**Total:** ~$2-6/month for AI Vision feature

## Use Cases
- 🍎 Fresh produce (apples, peppers, onions, etc.)
- 🥜 Bulk bin items (nuts, grains, candy)
- 🍪 Homemade/leftover foods
- 📦 Items where barcode won't scan
- 🌍 International products without UPC

## Error Handling
- Returns `success: false` with error message on failure
- Logs all steps to `edge_function_logs` table
- Graceful fallback to manual entry if AI fails
