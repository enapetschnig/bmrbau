-- Datei-Größenlimit pro Datei auf 200 MB anheben (vorher 50 MB)
-- Hintergrund: Pläne (PDF/Scan) und hochauflösende Fotos sind häufig >50 MB
-- und schlugen serverseitig still fehl.
UPDATE storage.buckets
SET file_size_limit = 209715200  -- 200 MB
WHERE id IN ('project-plans', 'project-reports', 'project-photos', 'project-materials');
