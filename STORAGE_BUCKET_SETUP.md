# Storage Bucket Setup - Manual Steps

**Why manual?** Storage bucket creation via SQL migrations violates RLS policies. The proper way is through Supabase Dashboard.

---

## Step-by-Step Guide

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/bwglyyfcdjzvvjdxxjmk/storage/buckets

### 2. Create New Bucket
Click **"New bucket"** button

**Settings:**
- **Name:** `user-food-photos`
- **Public bucket:** ✅ **Checked** (photos need to be viewable in app)
- **File size limit:** `5 MB` (5242880 bytes)
- **Allowed MIME types:** `image/jpeg, image/jpg, image/png, image/webp`

Click **"Create bucket"**

### 3. Set Up Policies

After bucket is created, click on the bucket name, then click **"Policies"** tab.

#### Policy 1: Users can upload photos
```sql
-- Name: Users can upload food photos
-- Operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Users can upload food photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-food-photos');
```

#### Policy 2: Public can view photos
```sql
-- Name: Public can view food photos
-- Operation: SELECT
-- Target roles: public

CREATE POLICY "Public can view food photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-food-photos');
```

#### Policy 3: Users can delete their photos
```sql
-- Name: Users can delete food photos
-- Operation: DELETE
-- Target roles: authenticated

CREATE POLICY "Users can delete food photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-food-photos');
```

### 4. Verify Setup

In the bucket settings, you should see:
- ✅ Bucket is public
- ✅ 5 MB file size limit
- ✅ JPEG, PNG, WEBP allowed
- ✅ 3 policies active

---

## Alternative: Create via Dashboard UI

Instead of SQL policies, you can use the policy builder in the Dashboard:

1. Click **"New Policy"**
2. Choose template: **"Allow public read access"**
3. Customize for authenticated uploads
4. Save

---

## Test Upload

After setup, test with curl:

```bash
# Get a test image
curl -o /tmp/test_apple.jpg "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400"

# Upload to bucket (replace YOUR_ANON_KEY)
curl -X POST \
  "https://bwglyyfcdjzvvjdxxjmk.supabase.co/storage/v1/object/user-food-photos/test_apple.jpg" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@/tmp/test_apple.jpg"

# Verify public access (should return image)
curl "https://bwglyyfcdjzvvjdxxjmk.supabase.co/storage/v1/object/public/user-food-photos/test_apple.jpg" \
  -o /tmp/downloaded.jpg
```

---

## What's Already Applied

The database migration for table columns was already applied successfully:
- ✅ `inventory_items.photo_user_uploaded` column added
- ✅ `inventory_items.ai_identified_name` column added
- ✅ `inventory_items.ai_confidence` column added

**Only the storage bucket needs manual creation.**

---

## Next Steps After Bucket Created

1. ✅ Storage bucket created manually
2. ⏳ Get OpenAI API key
3. ⏳ Set Supabase secrets
4. ⏳ Deploy edge function
5. ⏳ Test end-to-end

---

**Ready?** Once you've created the bucket via Dashboard, let me know and we'll continue with deployment!
