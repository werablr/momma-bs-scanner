# AI Vision Feature - Deployment Guide

**Date:** November 12, 2025
**Feature:** AI-powered food identification for produce/bulk items without barcodes

---

## ✅ What's Been Created

### 1. Database Migration
**File:** `supabase/migrations/20251112_add_ai_vision_columns.sql`

**What it does:**
- Adds `photo_user_uploaded` column to `inventory_items` table ✅ **APPLIED**
- Adds `ai_identified_name` column to track AI results ✅ **APPLIED**
- Adds `ai_confidence` column to track AI confidence scores ✅ **APPLIED**

**Note:** Storage bucket must be created manually via Dashboard (see Step 1 below)

### 2. Edge Function
**File:** `supabase/functions/identify-by-photo/index.ts`

**What it does:**
- Receives photo URL from mobile app
- Calls OpenAI GPT-4 Vision to identify food item
- Searches Open Food Facts by AI-identified name
- Returns top 5 matches with photos and nutrition data
- Logs all steps for debugging

**API Cost:** ~$0.01-0.03 per photo identification

---

## 🚀 Deployment Steps

### Step 1: Create Storage Bucket (Manual - Via Dashboard)

**⚠️ Important:** Storage bucket creation via SQL violates RLS. Must use Dashboard.

**Follow detailed guide:** [STORAGE_BUCKET_SETUP.md](STORAGE_BUCKET_SETUP.md)

**Quick steps:**
1. Go to: https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/storage/buckets
2. Click "New bucket"
3. Name: `user-food-photos`
4. Public: ✅ Checked
5. File size limit: `5 MB` (5242880 bytes)
6. Allowed MIME types: `image/jpeg, image/jpg, image/png, image/webp`
7. Create 3 RLS policies (see STORAGE_BUCKET_SETUP.md for SQL)

**Database columns:** ✅ **Already applied** via migration

### Step 2: Get OpenAI API Key

**Where to get it:**
1. Go to https://platform.openai.com/api-keys
2. Create new API key (name it "Momma B's Scanner - Vision")
3. Copy the key (starts with `sk-proj-...`)
4. **Store in 1Password** under "Momma B's Scanner - OpenAI API Key"

**Pricing (as of Nov 2025):**
- GPT-4 Vision: $0.01 per image (low res) or $0.03 (high res)
- Expected usage: 10-20 items/week = $2-6/month
- Free tier: No free tier for GPT-4 Vision

### Step 3: Set Supabase Secrets

```bash
# Set OpenAI API key (get from 1Password)
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Verify secrets are set
supabase secrets list
```

**Expected output:**
```
NAME                          VALUE
OPENAI_API_KEY               sk-proj-***************
SUPABASE_SERVICE_ROLE_KEY    [set]
SUPABASE_URL                 [set]
```

### Step 4: Deploy Edge Function

```bash
# Deploy identify-by-photo function
supabase functions deploy identify-by-photo

# Verify deployment
supabase functions list
```

**Expected output:**
```
identify-by-photo (deployed)
scanner-ingest (deployed)
```

### Step 5: Test Edge Function

**Manual test with curl:**
```bash
# Upload a test photo first (or use existing photo URL)
curl -X POST \
  https://bwglyyfcdjzvvjdxxjmk.functions.supabase.co/identify-by-photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "photo_url": "https://example.com/apple.jpg",
    "household_id": "7c093e13-4bcf-463e-96c1-9f499de9c4f2"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "ai_identification": {
    "name": "Fuji Apple",
    "confidence": 0.95,
    "category": "produce",
    "reasoning": "..."
  },
  "off_matches": [
    {
      "product_name": "Apple, Fuji",
      "brands": "Fresh Produce",
      "image_url": "...",
      "nutrition": { ... }
    }
  ],
  "total_matches": 12
}
```

---

## 📱 Mobile App Integration (Next Phase)

After backend is deployed, these mobile app changes are needed:

### Files to Create/Modify:
1. **Add "Scan by Photo" button** to main screen
2. **Create PhotoCaptureScreen.js** - Camera UI for taking photos
3. **Create AIMatchSelector.js** - Display AI matches, let user pick
4. **Update scannerAPI.js** - Add `identifyByPhoto()` method
5. **Add photo upload** to Supabase Storage

### Workflow:
```
User taps "Scan by Photo"
  ↓
Camera opens, user takes photo
  ↓
Photo uploads to user-food-photos bucket
  ↓
Call identify-by-photo edge function
  ↓
Show AI-identified name (editable)
  ↓
Display top 5 OFF matches with photos
  ↓
User selects correct match
  ↓
Continue to normal workflow (storage location + expiration)
  ↓
Save to inventory_items with photo_user_uploaded URL
```

---

## 🧪 Testing Checklist

After deployment, test these scenarios:

### Backend Tests (curl/Postman)
- [ ] Edge function accepts photo URL
- [ ] OpenAI Vision returns product name
- [ ] Open Food Facts search returns matches
- [ ] Error handling works (invalid URL, no matches)
- [ ] Logs appear in edge_function_logs table

### Mobile App Tests (once UI built)
- [ ] Photo capture works
- [ ] Photo uploads to Storage bucket
- [ ] AI identifies common produce (apple, pepper, onion)
- [ ] Matches display with photos
- [ ] User can select correct match
- [ ] Selected item saves to inventory with photo
- [ ] Photo displays in Pantry app

### Edge Cases
- [ ] Blurry photo (low confidence handling)
- [ ] Unknown item (fallback to manual entry)
- [ ] No internet (queue for later)
- [ ] Storage bucket full (error message)

---

## 🐛 Troubleshooting

### "OpenAI API key not configured"
**Fix:** Run `supabase secrets set OPENAI_API_KEY=sk-...`

### "Storage bucket not found"
**Fix:** Run migration: `supabase db push`

### "No matches found in Open Food Facts"
**Cause:** AI identified item doesn't exist in OFF database (rare produce)
**Fix:** Fallback to manual entry in mobile app

### "Photo upload fails"
**Cause:** File size > 5MB or wrong mime type
**Fix:** Resize photo before upload in mobile app

### Edge function times out
**Cause:** OpenAI API slow response (sometimes 10-15 seconds)
**Fix:** Increase timeout in edge function deployment config

---

## 💰 Cost Monitoring

**Monthly cost estimate:**
- OpenAI GPT-4 Vision: $2-6/month (10-20 photos)
- Supabase Storage: Free (first 1GB)
- Open Food Facts: Free (unlimited)

**Total: ~$2-6/month**

**Monitor usage:**
- OpenAI Dashboard: https://platform.openai.com/usage
- Supabase Storage: Dashboard → Storage → user-food-photos

---

## 📝 What to Tell Claude Next Session

**If deployment successful:**
> "AI Vision backend deployed! identify-by-photo function working, tested with sample photo. Ready to build mobile app UI. Start with: Add 'Scan by Photo' button to Scanner app home screen."

**If deployment issues:**
> "Read AI_VISION_DEPLOYMENT.md. Issue at step X: [describe error]. Check troubleshooting section."

---

## 🔗 References

- **Edge Function:** `supabase/functions/identify-by-photo/index.ts`
- **Migration:** `supabase/migrations/20251112_create_user_photos_bucket.sql`
- **OpenAI Vision Docs:** https://platform.openai.com/docs/guides/vision
- **Open Food Facts API:** https://wiki.openfoodfacts.org/API

---

**Ready to deploy?** Follow steps 1-5 above. Let me know if you want me to execute the deployment commands.
