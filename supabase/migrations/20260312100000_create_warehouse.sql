-- ============================================================
-- Warehouse product catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('kanaele','betonzubehoer','daemmung','kleinteile','baugeraete','schalungen')),
  einheit TEXT NOT NULL DEFAULT 'Stück',
  ek_preis NUMERIC(12,2),
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_warehouse_products_category ON warehouse_products(category);
CREATE INDEX idx_warehouse_products_name ON warehouse_products(name);

ALTER TABLE warehouse_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_products_select" ON warehouse_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "warehouse_products_insert" ON warehouse_products
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
  );

CREATE POLICY "warehouse_products_update" ON warehouse_products
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
  );

CREATE POLICY "warehouse_products_delete" ON warehouse_products
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
  );

-- ============================================================
-- Warehouse delivery notes (Lager-Lieferscheine)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('lager_to_baustelle','baustelle_to_lager','baustelle_to_baustelle')),
  source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  target_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  unterschrift TEXT NOT NULL,
  unterschrift_name TEXT,
  notizen TEXT,
  parent_note_id UUID REFERENCES warehouse_delivery_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wdn_user ON warehouse_delivery_notes(user_id);
CREATE INDEX idx_wdn_source ON warehouse_delivery_notes(source_project_id);
CREATE INDEX idx_wdn_target ON warehouse_delivery_notes(target_project_id);
CREATE INDEX idx_wdn_datum ON warehouse_delivery_notes(datum);
CREATE INDEX idx_wdn_parent ON warehouse_delivery_notes(parent_note_id);

ALTER TABLE warehouse_delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wdn_select" ON warehouse_delivery_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wdn_insert" ON warehouse_delivery_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wdn_update" ON warehouse_delivery_notes
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator'
    )
  );

CREATE POLICY "wdn_delete" ON warehouse_delivery_notes
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
  );

-- ============================================================
-- Delivery note line items
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES warehouse_delivery_notes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES warehouse_products(id),
  menge NUMERIC(12,3) NOT NULL CHECK (menge > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wdni_note ON warehouse_delivery_note_items(delivery_note_id);
CREATE INDEX idx_wdni_product ON warehouse_delivery_note_items(product_id);

ALTER TABLE warehouse_delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wdni_select" ON warehouse_delivery_note_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wdni_insert" ON warehouse_delivery_note_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Stock transaction log (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES warehouse_products(id),
  delivery_note_id UUID NOT NULL REFERENCES warehouse_delivery_notes(id) ON DELETE CASCADE,
  menge NUMERIC(12,3) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wst_product ON warehouse_stock_transactions(product_id);
CREATE INDEX idx_wst_note ON warehouse_stock_transactions(delivery_note_id);

ALTER TABLE warehouse_stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wst_select" ON warehouse_stock_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wst_insert" ON warehouse_stock_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Storage bucket for warehouse delivery note photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('warehouse-documents', 'warehouse-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "warehouse_docs_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'warehouse-documents');

CREATE POLICY "warehouse_docs_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'warehouse-documents');

CREATE POLICY "warehouse_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'warehouse-documents');
