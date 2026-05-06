CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(160) NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  href TEXT DEFAULT '/ilanlar',
  placement VARCHAR(40) NOT NULL DEFAULT 'home_hero',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active_placement
  ON banners (is_active, placement, sort_order);
