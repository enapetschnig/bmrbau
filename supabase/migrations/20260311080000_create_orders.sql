-- Orders table (one per order/screenshot upload)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  screenshot_url TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'teilweise_geliefert', 'vollstaendig')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order items (individual material lines extracted from screenshot or manually added)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  menge TEXT,
  einheit TEXT,
  status TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'geliefert')),
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery notes (Lieferscheine) linked to orders
CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orders_delete" ON orders FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator'
  )
);

CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_items_update" ON order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "order_items_delete" ON order_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "delivery_notes_select" ON delivery_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "delivery_notes_insert" ON delivery_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delivery_notes_delete" ON delivery_notes FOR DELETE TO authenticated USING (
  uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator'
  )
);

-- Indexes
CREATE INDEX idx_orders_project_id ON orders(project_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_delivery_notes_order_id ON delivery_notes(order_id);

-- Storage bucket for order screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-screenshots', 'order-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "order_screenshots_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-screenshots');

CREATE POLICY "order_screenshots_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-screenshots');

CREATE POLICY "order_screenshots_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-screenshots');
