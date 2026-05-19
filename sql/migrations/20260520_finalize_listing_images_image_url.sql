-- Final canonical image URL cleanup.
-- Keeps the public listing_images contract on image_url and removes old url/thumbnail_url drift.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE categories DROP COLUMN IF EXISTS description CASCADE;

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listing_images'
      AND column_name = 'url'
  ) THEN
    UPDATE listing_images
    SET image_url = url
    WHERE image_url IS NULL
      AND url IS NOT NULL;

    ALTER TABLE listing_images DROP COLUMN url CASCADE;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_listing_images_updated_at ON listing_images;

ALTER TABLE listing_images
  DROP COLUMN IF EXISTS thumbnail_url CASCADE,
  DROP COLUMN IF EXISTS mime_type CASCADE,
  DROP COLUMN IF EXISTS file_size CASCADE,
  DROP COLUMN IF EXISTS updated_at CASCADE;

UPDATE listing_images
SET image_url = '/uploads/missing-image-' || id::text
WHERE image_url IS NULL;

ALTER TABLE listing_images ALTER COLUMN image_url SET NOT NULL;

CREATE TABLE IF NOT EXISTS listing_image_files (
  image_id UUID PRIMARY KEY REFERENCES listing_images(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_images_primary ON listing_images(listing_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_listing_images_sort ON listing_images(listing_id, sort_order);
