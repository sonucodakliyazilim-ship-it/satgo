DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_order_status') THEN
    CREATE TYPE promotion_order_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

ALTER TABLE promotion_packages
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS label VARCHAR(100);

UPDATE promotion_packages
SET code = CASE
    WHEN type = 'featured' AND duration_days <= 1 THEN 'daily_featured'
    WHEN type = 'featured' THEN 'weekly_featured'
    WHEN type = 'urgent' THEN 'urgent'
    WHEN type = 'showcase' THEN 'showcase'
    WHEN type = 'boost' THEN 'single_boost'
    ELSE LOWER(REPLACE(name, ' ', '_'))
  END,
  label = COALESCE(label, name)
WHERE code IS NULL OR label IS NULL;

ALTER TABLE promotion_packages
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_packages_code ON promotion_packages(code);

INSERT INTO promotion_packages (name, label, code, type, description, price, duration_days, sort_order)
VALUES
  ('Günlük Öne Çıkarma', 'Günlük öne çıkarma', 'daily_featured', 'featured', 'İlan 1 gün boyunca öne çıkanlarda görünür.', 19.00, 1, 1),
  ('Haftalık Öne Çıkarma', 'Haftalık öne çıkarma', 'weekly_featured', 'featured', 'İlan 7 gün boyunca öne çıkanlarda görünür.', 89.00, 7, 2),
  ('Acil İlan', 'Acil ilan', 'urgent', 'urgent', 'İlana acil rozeti eklenir.', 39.00, 7, 3),
  ('Vitrin İlanı', 'Vitrin ilanı', 'showcase', 'showcase', 'İlan ana sayfa vitrin alanında görünür.', 129.00, 7, 4),
  ('Tekli İlan Yükseltme', 'Tekli ilan yükseltme', 'single_boost', 'boost', 'İlan bir defaya mahsus listede yukarı taşınır.', 24.00, 1, 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  label = EXCLUDED.label,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS promotion_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES promotion_packages(id),
  amount NUMERIC(10,2) NOT NULL,
  status promotion_order_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer',
  bank_name TEXT,
  iban TEXT,
  iban_owner TEXT,
  payment_code VARCHAR(40) UNIQUE NOT NULL,
  user_note TEXT,
  admin_note TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_promotion_id UUID REFERENCES listing_promotions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_user ON promotion_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_listing ON promotion_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_status ON promotion_orders(status);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_created ON promotion_orders(created_at DESC);

ALTER TABLE listing_promotions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES promotion_orders(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_listing_promotions_order ON listing_promotions(order_id);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_active ON listing_promotions(listing_id, ends_at)
  WHERE payment_status = 'completed' AND status = 'active';

CREATE OR REPLACE FUNCTION sync_listing_promotions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed'
     AND NEW.status = 'active'
     AND (NEW.ends_at IS NULL OR NEW.ends_at > NOW()) THEN
    IF NEW.type = 'featured' THEN
      UPDATE listings SET is_featured = TRUE, featured_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'urgent' THEN
      UPDATE listings SET is_urgent = TRUE, urgent_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'showcase' THEN
      UPDATE listings SET is_showcase = TRUE, showcase_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'boost' THEN
      UPDATE listings SET boosted_at = NOW() WHERE id = NEW.listing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_promotions ON listing_promotions;
CREATE TRIGGER trg_sync_promotions
  AFTER INSERT OR UPDATE ON listing_promotions
  FOR EACH ROW EXECUTE FUNCTION sync_listing_promotions();
