-- Create scans table for barcode scanner workflow
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Barcode and product info
    barcode TEXT NOT NULL,
    product_name TEXT,
    brand TEXT,

    -- Nutritional data
    serving_size DECIMAL,
    serving_unit TEXT,
    calories DECIMAL,
    total_fat DECIMAL,
    saturated_fat DECIMAL,
    cholesterol DECIMAL,
    sodium DECIMAL,
    total_carbohydrate DECIMAL,
    dietary_fiber DECIMAL,
    sugars DECIMAL,
    protein DECIMAL,

    -- Storage and expiration
    storage_location_id UUID REFERENCES public.storage_locations(id),
    expiration_date DATE,

    -- OCR data for expiration date
    ocr_text TEXT,
    ocr_confidence DECIMAL,
    ocr_processing_time_ms INTEGER,

    -- Workflow status
    status TEXT DEFAULT 'pending_expiration' CHECK (status IN ('pending_expiration', 'complete', 'failed')),

    -- User tracking (optional for now)
    household_id UUID
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON public.scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS scans_barcode_idx ON public.scans(barcode);
CREATE INDEX IF NOT EXISTS scans_storage_location_id_idx ON public.scans(storage_location_id);
CREATE INDEX IF NOT EXISTS scans_household_id_idx ON public.scans(household_id);
CREATE INDEX IF NOT EXISTS scans_created_at_idx ON public.scans(created_at DESC);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert and read their own scans
CREATE POLICY "Allow anonymous insert" ON public.scans
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON public.scans
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Allow anonymous update" ON public.scans
    FOR UPDATE TO anon
    USING (true);

-- Grant permissions
GRANT ALL ON public.scans TO anon;
GRANT ALL ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
