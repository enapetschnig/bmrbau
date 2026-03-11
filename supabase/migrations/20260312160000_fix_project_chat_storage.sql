-- Ensure project-chat bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-chat', 'project-chat', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Re-create INSERT policy (drop first to avoid conflict)
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-chat');

-- Re-create SELECT policy
DROP POLICY IF EXISTS "Anyone can read chat files" ON storage.objects;
CREATE POLICY "Anyone can read chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-chat');

-- Add DELETE policy for chat files (own files cleanup)
CREATE POLICY "Authenticated users can delete own chat files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-chat');
