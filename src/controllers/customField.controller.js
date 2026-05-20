const { query, withTransaction } = require('../config/database');

const FIELD_TYPES = new Set(['text', 'number', 'select', 'radio', 'checkbox', 'multi_select', 'textarea']);
const OPTION_FIELD_TYPES = new Set(['select', 'radio', 'multi_select']);

const normalizeTurkish = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const makeKey = (value) =>
  normalizeTurkish(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeFieldType = (value) => {
  const type = String(value || 'text').trim();
  const aliases = {
    input: 'text',
    boolean: 'checkbox',
    bool: 'checkbox',
    dropdown: 'select',
    multiselect: 'multi_select',
    multiple: 'multi_select',
    multi: 'multi_select',
  };
  return aliases[type] || type;
};

const mapField = (field) => ({
  ...field,
  field_key: field.key,
  field_type: field.type,
  is_required: field.required,
  sub_category_id: null,
});

const ensureTables = async () => {
  await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await query(`
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
    )
  `);

  await query(`
    ALTER TABLE custom_fields
      ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS label VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "key" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await query(`
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
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'is_required'
      ) THEN
        UPDATE custom_fields SET "required" = COALESCE("required", is_required, FALSE);
      END IF;
    END $$;
  `);

  await query(`
    UPDATE custom_fields
    SET
      label = COALESCE(NULLIF(label, ''), 'Alan ' || id::text),
      "type" = CASE
        WHEN "type" IN ('text', 'number', 'select', 'radio', 'checkbox', 'multi_select', 'textarea') THEN "type"
        ELSE 'text'
      END,
      "required" = COALESCE("required", FALSE),
      sort_order = COALESCE(sort_order, 0),
      is_active = COALESCE(is_active, TRUE)
  `);

  await query(`
    WITH missing AS (
      SELECT id, 'field_' || ROW_NUMBER() OVER (ORDER BY created_at, id)::text AS key_value
      FROM custom_fields
      WHERE "key" IS NULL OR "key" = ''
    )
    UPDATE custom_fields f
    SET "key" = missing.key_value
    FROM missing
    WHERE f.id = missing.id
  `);

  await query(`
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
    WHERE f.id IN (SELECT id FROM ranked WHERE rn > 1)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS custom_field_options (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      label VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(field_id, value)
    )
  `);

  await query(`
    ALTER TABLE custom_field_options
      ADD COLUMN IF NOT EXISTS label VARCHAR(255),
      ADD COLUMN IF NOT EXISTS value VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS listing_field_values (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(listing_id, field_id)
    )
  `);

  await query(`
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
  `);

  await query('CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_category_key_unique ON custom_fields (category_id, "key")');
  await query('CREATE INDEX IF NOT EXISTS idx_custom_fields_category_active ON custom_fields (category_id, is_active, sort_order)');
  await query('CREATE INDEX IF NOT EXISTS idx_custom_field_options_field_sort ON custom_field_options (field_id, sort_order)');
  await query('CREATE INDEX IF NOT EXISTS idx_listing_field_values_listing ON listing_field_values (listing_id)');
};

const appendOptions = async (fields, client = null) => {
  const runner = client || { query };
  for (const field of fields) {
    const optionRows = await runner.query(
      `SELECT id, field_id, label, value, sort_order
       FROM custom_field_options
       WHERE field_id = $1
       ORDER BY sort_order, label`,
      [field.id],
    );
    field.options = optionRows.rows;
  }
  return fields;
};

const getCustomFields = async (req, res, next) => {
  try {
    await ensureTables();
    const categoryId = Number(req.query.sub_category_id || req.query.category_id);
    if (!categoryId) {
      return res.status(422).json({ success: false, message: 'category_id gerekli.' });
    }

    const { rows } = await query(
      `WITH RECURSIVE ancestors AS (
         SELECT id, parent_id, 0 AS depth
         FROM categories
         WHERE id = $1
         UNION ALL
         SELECT parent.id, parent.parent_id, ancestors.depth + 1
         FROM categories parent
         JOIN ancestors ON ancestors.parent_id = parent.id
       ),
       ranked AS (
         SELECT f.*, ancestors.depth,
                ROW_NUMBER() OVER (PARTITION BY f."key" ORDER BY ancestors.depth ASC, f.sort_order ASC) AS key_rank
         FROM custom_fields f
         JOIN ancestors ON ancestors.id = f.category_id
         WHERE f.is_active = TRUE
       )
       SELECT id, category_id, label, "key", "type", "required", sort_order, is_active, created_at, updated_at
       FROM ranked
       WHERE key_rank = 1
       ORDER BY sort_order, label`,
      [categoryId],
    );

    const fields = await appendOptions(rows.map(mapField));
    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
};

const adminList = async (req, res, next) => {
  try {
    await ensureTables();
    const { rows } = await query(
      `SELECT f.id, f.category_id, f.label, f."key", f."type", f."required",
              f.sort_order, f.is_active, f.created_at, f.updated_at,
              c.name AS category_name
       FROM custom_fields f
       LEFT JOIN categories c ON c.id = f.category_id
       ORDER BY f.category_id, f.sort_order, f.label
       LIMIT 1000`,
    );

    const fields = await appendOptions(rows.map(mapField));
    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
};

const adminUpsert = async (req, res, next) => {
  try {
    await ensureTables();
    const body = req.body || {};
    const categoryId = Number(body.sub_category_id || body.category_id);
    const cleanLabel = String(body.label || '').trim();
    const cleanKey = makeKey(body.key || body.field_key || cleanLabel);
    const cleanType = normalizeFieldType(body.type || body.field_type);
    const required = body.required ?? body.is_required ?? false;
    const isActive = body.is_active !== false;

    if (!categoryId || !cleanLabel || !cleanKey) {
      return res.status(422).json({ success: false, message: 'Kategori ve alan adi gerekli.' });
    }

    if (!FIELD_TYPES.has(cleanType)) {
      return res.status(422).json({ success: false, message: 'Gecersiz alan tipi.' });
    }

    const cleanOptions = Array.isArray(body.options)
      ? body.options
          .map((option, index) => {
            const label = String(option?.label || option?.value || '').trim();
            const value = String(option?.value || label).trim();
            return {
              label,
              value,
              sort_order: Number(option?.sort_order ?? index * 10),
            };
          })
          .filter((option) => option.label && option.value)
      : [];

    const saved = await withTransaction(async (client) => {
      let field;
      if (body.id) {
        const { rows } = await client.query(
          `UPDATE custom_fields SET
             category_id = $1,
             label = $2,
             "key" = $3,
             "type" = $4,
             "required" = $5,
             sort_order = $6,
             is_active = $7,
             updated_at = NOW()
           WHERE id = $8
           RETURNING id, category_id, label, "key", "type", "required", sort_order, is_active, created_at, updated_at`,
          [
            categoryId,
            cleanLabel,
            cleanKey,
            cleanType,
            required === true || required === 'true',
            Number(body.sort_order || 0),
            isActive,
            body.id,
          ],
        );
        field = rows[0];
      } else {
        const { rows } = await client.query(
          `INSERT INTO custom_fields (category_id, label, "key", "type", "required", sort_order, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (category_id, "key") DO UPDATE SET
             label = EXCLUDED.label,
             "type" = EXCLUDED."type",
             "required" = EXCLUDED."required",
             sort_order = EXCLUDED.sort_order,
             is_active = EXCLUDED.is_active,
             updated_at = NOW()
           RETURNING id, category_id, label, "key", "type", "required", sort_order, is_active, created_at, updated_at`,
          [
            categoryId,
            cleanLabel,
            cleanKey,
            cleanType,
            required === true || required === 'true',
            Number(body.sort_order || 0),
            isActive,
          ],
        );
        field = rows[0];
      }

      await client.query('DELETE FROM custom_field_options WHERE field_id = $1', [field.id]);
      if (OPTION_FIELD_TYPES.has(field.type)) {
        for (const option of cleanOptions) {
          await client.query(
            `INSERT INTO custom_field_options (field_id, label, value, sort_order)
             VALUES ($1,$2,$3,$4)`,
            [field.id, option.label, option.value, option.sort_order],
          );
        }
      }

      const [mapped] = await appendOptions([mapField(field)], client);
      return mapped;
    });

    res.json({ success: true, message: 'Alan kaydedildi.', data: saved });
  } catch (err) {
    next(err);
  }
};

const adminDelete = async (req, res, next) => {
  try {
    await ensureTables();
    const { rows } = await query(
      `UPDATE custom_fields
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, category_id, label, "key", "type", "required", sort_order, is_active, created_at, updated_at`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Alan bulunamadi.' });
    res.json({ success: true, message: 'Alan silindi.', data: mapField(rows[0]) });
  } catch (err) {
    next(err);
  }
};

const upsertListingCustomFields = async (client, listingId, customFields = []) => {
  if (!Array.isArray(customFields) || !customFields.length) return;

  const rowMap = new Map();
  for (const item of customFields) {
    const fieldId = String(item?.field_id || item?.id || '').trim();
    if (!fieldId) continue;

    const value = item?.value;
    const normalizedValue = Array.isArray(value)
      ? JSON.stringify(value.map(String))
      : value === undefined || value === null
        ? null
        : String(value);

    rowMap.set(fieldId, { fieldId, value: normalizedValue });
  }

  const rows = Array.from(rowMap.values());
  if (!rows.length) return;

  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 2 + 2;
    values.push(row.fieldId, row.value);
    return `($${base}::uuid, $${base + 1}::text)`;
  });

  await client.query(
    `INSERT INTO listing_field_values (listing_id, field_id, value)
     SELECT $1::uuid, input.field_id, input.value
     FROM (VALUES ${placeholders.join(',')}) AS input(field_id, value)
     JOIN custom_fields f ON f.id = input.field_id AND f.is_active = TRUE
     ON CONFLICT (listing_id, field_id) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW()`,
    [listingId, ...values],
  );
};

module.exports = {
  ensureTables,
  getCustomFields,
  adminList,
  adminUpsert,
  adminDelete,
  upsertListingCustomFields,
};
