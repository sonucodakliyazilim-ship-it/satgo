ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS hierarchy_group VARCHAR(80),
  ADD COLUMN IF NOT EXISTS hierarchy_path TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hierarchy_labels TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_listings_hierarchy_group
  ON listings (hierarchy_group);
