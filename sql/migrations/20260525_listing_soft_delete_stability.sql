-- Listing delete stability
-- Keeps listing deletion cheap and reversible by hiding rows instead of cascading
-- through images, favorites, messages, reports, promotions and other related data.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_listings_not_deleted
  ON listings(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_active_not_deleted
  ON listings(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_user_not_deleted
  ON listings(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_category_not_deleted
  ON listings(category_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

ANALYZE listings;
