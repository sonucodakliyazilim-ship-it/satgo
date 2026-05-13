CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  sub_category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(160) NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'input',
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS field_type VARCHAR(20) NOT NULL DEFAULT 'input',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE custom_fields
SET field_type = CASE field_type
  WHEN 'text' THEN 'input'
  WHEN 'boolean' THEN 'checkbox'
  ELSE field_type
END;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY category_id, sub_category_id, field_key
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM custom_fields
)
UPDATE custom_fields
SET is_active = FALSE,
    updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_unique_root_scope
  ON custom_fields (category_id, field_key)
  WHERE sub_category_id IS NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_unique_sub_scope
  ON custom_fields (category_id, sub_category_id, field_key)
  WHERE sub_category_id IS NOT NULL AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS custom_field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value VARCHAR(120) NOT NULL,
  label VARCHAR(160) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_field_options_unique UNIQUE (field_id, value)
);

CREATE TABLE IF NOT EXISTS listing_custom_fields (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DOUBLE PRECISION,
  value_bool BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_category
  ON custom_fields (category_id, sub_category_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_listing_custom_fields_listing
  ON listing_custom_fields (listing_id);

CREATE TABLE IF NOT EXISTS hierarchy_group_settings (
  group_key VARCHAR(80) PRIMARY KEY,
  group_label VARCHAR(160),
  group_hint VARCHAR(255),
  level_labels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
