-- Clean category, dynamic field, listing value and image schema.
-- This migration is intentionally additive/migratory instead of dropping listings.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE listing_status AS ENUM ('active', 'passive', 'sold', 'pending', 'rejected');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'active';
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'passive';
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'sold';
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'pending';
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_condition') THEN
    CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  icon VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(200),
  ADD COLUMN IF NOT EXISTS icon VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE categories
SET
  sort_order = COALESCE(sort_order, 0),
  is_active = COALESCE(is_active, TRUE),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_order ON categories(parent_id, is_active, sort_order, name);

INSERT INTO categories (name, slug, icon, sort_order, is_active)
VALUES
  ('Araç', 'arac', 'car', 1, TRUE),
  ('Motor', 'motor', 'motorbike', 2, TRUE),
  ('Emlak', 'emlak', 'home', 3, TRUE),
  ('Elektronik', 'elektronik', 'smartphone', 4, TRUE),
  ('Ev Eşyası', 'ev-esyasi', 'sofa', 5, TRUE),
  ('Giyim', 'giyim', 'shirt', 6, TRUE),
  ('Hizmet', 'hizmet', 'tool', 7, TRUE),
  ('İş İlanları', 'is-ilanlari', 'briefcase', 8, TRUE),
  ('Spor', 'spor', 'trophy', 9, TRUE),
  ('Diğer', 'diger', 'box', 10, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO categories (parent_id, name, slug, sort_order, is_active)
SELECT parent.id, child.name, child.slug, child.sort_order, TRUE
FROM (
  VALUES
    ('arac', 'Otomobil', 'otomobil', 1),
    ('arac', 'SUV & 4x4', 'suv', 2),
    ('arac', 'Ticari Araç', 'ticari-arac', 3),
    ('motor', 'Motosiklet', 'motosiklet', 1),
    ('emlak', 'Konut', 'konut', 1),
    ('emlak', 'İş Yeri', 'is-yeri', 2),
    ('emlak', 'Arsa & Tarla', 'arsa', 3),
    ('elektronik', 'Telefon', 'elektronik-telefon', 1),
    ('elektronik', 'Bilgisayar', 'bilgisayar', 2)
) AS child(parent_slug, name, slug, sort_order)
JOIN categories parent ON parent.slug = child.parent_slug
ON CONFLICT (slug) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'text',
  "required" BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "key" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'sub_category_id'
  ) THEN
    UPDATE custom_fields
    SET category_id = sub_category_id
    WHERE sub_category_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'field_key'
  ) THEN
    UPDATE custom_fields
    SET "key" = COALESCE(NULLIF("key", ''), NULLIF(field_key, ''), 'field_' || replace(left(id::text, 8), '-', ''));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'field_type'
  ) THEN
    UPDATE custom_fields
    SET "type" = CASE COALESCE(NULLIF("type", ''), field_type, 'text')
      WHEN 'input' THEN 'text'
      WHEN 'boolean' THEN 'checkbox'
      WHEN 'bool' THEN 'checkbox'
      WHEN 'dropdown' THEN 'select'
      WHEN 'multiselect' THEN 'multi_select'
      ELSE COALESCE(NULLIF("type", ''), field_type, 'text')
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'is_required'
  ) THEN
    UPDATE custom_fields
    SET "required" = COALESCE("required", is_required, FALSE);
  END IF;
END $$;

UPDATE custom_fields
SET
  label = COALESCE(NULLIF(label, ''), 'Alan ' || replace(left(id::text, 8), '-', '')),
  "type" = CASE
    WHEN "type" IN ('text', 'number', 'select', 'radio', 'checkbox', 'multi_select', 'textarea') THEN "type"
    ELSE 'text'
  END,
  "required" = COALESCE("required", FALSE),
  sort_order = COALESCE(sort_order, 0),
  is_active = COALESCE(is_active, TRUE),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

DELETE FROM custom_fields
WHERE category_id IS NULL;

WITH missing AS (
  SELECT id, 'field_' || ROW_NUMBER() OVER (ORDER BY created_at, id)::text AS key_value
  FROM custom_fields
  WHERE "key" IS NULL OR "key" = ''
)
UPDATE custom_fields f
SET "key" = missing.key_value
FROM missing
WHERE f.id = missing.id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY category_id, "key"
           ORDER BY is_active DESC, updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM custom_fields
)
UPDATE custom_fields f
SET
  is_active = FALSE,
  "key" = f."key" || '_' || replace(left(f.id::text, 8), '-', ''),
  updated_at = NOW()
WHERE f.id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS custom_fields_unique_root_scope;
DROP INDEX IF EXISTS custom_fields_unique_sub_scope;
DROP INDEX IF EXISTS idx_custom_fields_category;
CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_category_key_unique ON custom_fields(category_id, "key");
CREATE INDEX IF NOT EXISTS idx_custom_fields_category_active ON custom_fields(category_id, is_active, sort_order);

ALTER TABLE custom_fields
  ALTER COLUMN category_id SET NOT NULL,
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN "key" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "required" SET NOT NULL;

ALTER TABLE custom_fields
  DROP COLUMN IF EXISTS sub_category_id CASCADE,
  DROP COLUMN IF EXISTS field_key CASCADE,
  DROP COLUMN IF EXISTS field_type CASCADE,
  DROP COLUMN IF EXISTS is_required CASCADE;

CREATE TABLE IF NOT EXISTS custom_field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  value VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(field_id, value)
);

ALTER TABLE custom_field_options
  ADD COLUMN IF NOT EXISTS label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_field_options' AND column_name = 'is_active'
  ) THEN
    DELETE FROM custom_field_options WHERE is_active = FALSE;
  END IF;
END $$;

UPDATE custom_field_options
SET
  label = COALESCE(NULLIF(label, ''), value, 'Seçenek'),
  value = COALESCE(NULLIF(value, ''), label, replace(left(id::text, 8), '-', '')),
  sort_order = COALESCE(sort_order, 0),
  created_at = COALESCE(created_at, NOW());

ALTER TABLE custom_field_options
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN value SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  DROP COLUMN IF EXISTS is_active CASCADE,
  DROP COLUMN IF EXISTS updated_at CASCADE;

CREATE INDEX IF NOT EXISTS idx_custom_field_options_field_sort ON custom_field_options(field_id, sort_order);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS status listing_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS price_negotiable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS condition listing_condition DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS hierarchy_group VARCHAR(80),
  ADD COLUMN IF NOT EXISTS hierarchy_path TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hierarchy_labels TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_showcase BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS urgent_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS showcase_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE listings
SET category_id = sub_category_id
WHERE sub_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);

CREATE TABLE IF NOT EXISTS listing_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, field_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listing_custom_fields'
  ) THEN
    INSERT INTO listing_field_values (listing_id, field_id, value, created_at, updated_at)
    SELECT
      listing_id,
      field_id,
      COALESCE(value_text, value_number::text, value_bool::text),
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM listing_custom_fields
    ON CONFLICT (listing_id, field_id) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW();
  END IF;
END $$;

DROP TABLE IF EXISTS listing_custom_fields CASCADE;
DROP TABLE IF EXISTS custom_field_values CASCADE;
DROP TABLE IF EXISTS category_fields CASCADE;

CREATE INDEX IF NOT EXISTS idx_listing_field_values_listing ON listing_field_values(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_field_values_field ON listing_field_values(field_id);

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listing_images' AND column_name = 'url'
  ) THEN
    UPDATE listing_images SET image_url = url WHERE image_url IS NULL AND url IS NOT NULL;
    ALTER TABLE listing_images DROP COLUMN url CASCADE;
  END IF;
END $$;

UPDATE listing_images
SET
  image_url = COALESCE(image_url, '/uploads/missing-image-' || id::text),
  is_primary = COALESCE(is_primary, FALSE),
  sort_order = COALESCE(sort_order, 0),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

ALTER TABLE listing_images
  ALTER COLUMN image_url SET NOT NULL,
  ALTER COLUMN is_primary SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL;

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON custom_fields;
CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listing_field_values_updated_at ON listing_field_values;
CREATE TRIGGER update_listing_field_values_updated_at
  BEFORE UPDATE ON listing_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listing_images_updated_at ON listing_images;
CREATE TRIGGER update_listing_images_updated_at
  BEFORE UPDATE ON listing_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
