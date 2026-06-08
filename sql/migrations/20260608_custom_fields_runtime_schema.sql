CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'field_key'
  ) THEN
    UPDATE custom_fields
    SET "key" = COALESCE(NULLIF("key", ''), NULLIF(field_key, ''), 'field_' || id::text);
    ALTER TABLE custom_fields ALTER COLUMN field_key DROP NOT NULL;
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
    ALTER TABLE custom_fields ALTER COLUMN field_type DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'is_required'
  ) THEN
    UPDATE custom_fields SET "required" = COALESCE("required", is_required, FALSE);
  END IF;
END $$;

UPDATE custom_fields
SET
  label = COALESCE(NULLIF(label, ''), 'Alan ' || id::text),
  "type" = CASE
    WHEN "type" IN ('text', 'number', 'select', 'radio', 'checkbox', 'multi_select', 'textarea') THEN "type"
    ELSE 'text'
  END,
  "required" = COALESCE("required", FALSE),
  sort_order = COALESCE(sort_order, 0),
  is_active = COALESCE(is_active, TRUE);

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

CREATE TABLE IF NOT EXISTS custom_field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  label VARCHAR(255),
  value VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(field_id, value)
);

ALTER TABLE custom_field_options
  ADD COLUMN IF NOT EXISTS label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE custom_field_options
SET
  label = COALESCE(NULLIF(label, ''), value, 'Seçenek ' || id::text),
  value = COALESCE(NULLIF(value, ''), label, id::text);

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

CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_category_key_unique
  ON custom_fields (category_id, "key");

CREATE INDEX IF NOT EXISTS idx_custom_fields_category_active
  ON custom_fields (category_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_custom_field_options_field_sort
  ON custom_field_options (field_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_listing_field_values_listing
  ON listing_field_values (listing_id);
