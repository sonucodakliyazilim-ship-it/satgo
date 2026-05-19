CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE custom_fields
  ALTER COLUMN field_type SET DEFAULT 'text';

UPDATE custom_fields
SET field_type = CASE field_type
  WHEN 'input' THEN 'text'
  WHEN 'boolean' THEN 'checkbox'
  ELSE field_type
END;

ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS image_url TEXT;
UPDATE listing_images SET image_url = url WHERE image_url IS NULL AND url IS NOT NULL;

CREATE TABLE IF NOT EXISTS listing_image_files (
  image_id UUID PRIMARY KEY REFERENCES listing_images(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_nav_order
  ON categories (parent_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_custom_fields_category_active
  ON custom_fields (category_id, sub_category_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_order
  ON listing_images (listing_id, is_primary DESC, sort_order, created_at);
