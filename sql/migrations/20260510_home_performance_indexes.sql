CREATE INDEX IF NOT EXISTS idx_listings_active_created
  ON listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_active_popular
  ON listings (status, view_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_active_favorites
  ON listings (status, favorite_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_active_boosted
  ON listings (status, boosted_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_images_primary_lookup
  ON listing_images (listing_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_listing_promotions_active_expiry
  ON listing_promotions (payment_status, status, ends_at, listing_id, type);
