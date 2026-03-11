-- Add photo columns to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rechnung_foto_url TEXT;

-- Storage bucket for equipment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload equipment photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'equipment-photos');

CREATE POLICY "Authenticated users can update equipment photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'equipment-photos');

CREATE POLICY "Anyone can view equipment photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'equipment-photos');

CREATE POLICY "Admins can delete equipment photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'equipment-photos');
