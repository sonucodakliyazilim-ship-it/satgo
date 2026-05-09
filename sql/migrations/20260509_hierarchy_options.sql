CREATE TABLE IF NOT EXISTS hierarchy_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_key VARCHAR(80) NOT NULL,
  parent_id UUID REFERENCES hierarchy_options(id) ON DELETE CASCADE,
  parent_key UUID GENERATED ALWAYS AS (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  label VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hierarchy_options_unique_path UNIQUE (group_key, parent_key, slug)
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_options_group_parent
  ON hierarchy_options (group_key, parent_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_hierarchy_options_active
  ON hierarchy_options (group_key, is_active);

ALTER TABLE vehicle_details
  ADD COLUMN IF NOT EXISTS series VARCHAR(100),
  ADD COLUMN IF NOT EXISTS package_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trim_name VARCHAR(100);

ALTER TABLE motorcycle_details
  ADD COLUMN IF NOT EXISTS series VARCHAR(100),
  ADD COLUMN IF NOT EXISTS package_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trim_name VARCHAR(100);
