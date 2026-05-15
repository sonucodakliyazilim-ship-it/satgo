const { query, withTransaction } = require('../config/database');
const crypto = require('crypto');

const makeKey = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeFieldType = (value) => {
  const type = String(value || 'input').trim();
  const aliases = {
    text: 'input',
    boolean: 'checkbox',
    bool: 'checkbox',
    dropdown: 'select',
    multiselect: 'multi_select',
    multiple: 'multi_select',
    multi: 'multi_select',
  };
  return aliases[type] || type;
};

const OPTION_FIELD_TYPES = new Set(['select', 'radio', 'multi_select']);

const ensureTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id UUID PRIMARY KEY,
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
    )
  `);

  await query(`
    ALTER TABLE custom_fields
      ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS field_type VARCHAR(20) NOT NULL DEFAULT 'input',
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await query(`
    UPDATE custom_fields
    SET field_type = CASE field_type
      WHEN 'text' THEN 'input'
      WHEN 'boolean' THEN 'checkbox'
      ELSE field_type
    END
  `);

  await query(`
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
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_unique_root_scope
    ON custom_fields (category_id, field_key)
    WHERE sub_category_id IS NULL AND is_active = TRUE
  `).catch((err) => {
    console.warn('[custom-fields] root unique index skipped:', err.message);
  });

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_unique_sub_scope
    ON custom_fields (category_id, sub_category_id, field_key)
    WHERE sub_category_id IS NOT NULL AND is_active = TRUE
  `).catch((err) => {
    console.warn('[custom-fields] sub unique index skipped:', err.message);
  });

  await query(`
    CREATE TABLE IF NOT EXISTS custom_field_options (
      id UUID PRIMARY KEY,
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value VARCHAR(120) NOT NULL,
      label VARCHAR(160) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT custom_field_options_unique UNIQUE (field_id, value)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS listing_custom_fields (
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value_text TEXT,
      value_number DOUBLE PRECISION,
      value_bool BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (listing_id, field_id)
    )
  `);
};

const getCustomFields = async (req, res, next) => {
  try {
    try {
      await ensureTables();
    } catch (schemaErr) {
      console.warn('[custom-fields] schema check skipped:', schemaErr.message);
      return res.json({ success: true, data: [] });
    }
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const subCategoryId = req.query.sub_category_id ? Number(req.query.sub_category_id) : null;

    if (!categoryId) return res.status(422).json({ success: false, message: 'category_id gerekli.' });

    const params = [categoryId];
    let fieldSql = `
      SELECT f.*, 99999 AS scope_depth
      FROM custom_fields f
      WHERE f.is_active = TRUE
        AND f.category_id = $1
        AND f.sub_category_id IS NULL
    `;
    if (subCategoryId) {
      params.push(subCategoryId);
      fieldSql = `
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id, 0 AS depth
          FROM categories
          WHERE id = $2
          UNION ALL
          SELECT parent.id, parent.parent_id, ancestors.depth + 1
          FROM categories parent
          JOIN ancestors ON ancestors.parent_id = parent.id
        )
        SELECT f.*, COALESCE(a.depth, 99999) AS scope_depth
        FROM custom_fields f
        LEFT JOIN ancestors a ON a.id = f.sub_category_id
        WHERE f.is_active = TRUE
          AND f.category_id = $1
          AND (f.sub_category_id IS NULL OR f.sub_category_id IN (SELECT id FROM ancestors))
      `;
    }

    const { rows } = await query(`${fieldSql} ORDER BY f.sub_category_id NULLS LAST, f.sort_order, f.label`, params);

    // If sub_category_id provided, remove duplicate keys by keeping the most specific (sub_category scoped) one.
    const byKey = new Map();
    for (const row of rows) {
      const key = row.field_key;
      const existing = byKey.get(key);
      const rowScore = Number(row.scope_depth ?? 99999);
      const existingScore = Number(existing?.scope_depth ?? 99999);
      if (!existing) byKey.set(key, row);
      else if (rowScore < existingScore) byKey.set(key, row);
    }
    const fields = Array.from(byKey.values());
    for (const field of fields) {
      const optionRows = await query(
        `SELECT id, value, label, sort_order
         FROM custom_field_options
         WHERE field_id = $1 AND is_active = TRUE
         ORDER BY sort_order, label`,
        [field.id],
      );
      field.options = optionRows.rows;
    }

    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
};

const adminList = async (req, res, next) => {
  try {
    await ensureTables();
    const { rows } = await query(
      `SELECT f.*,
              c.name AS category_name,
              sc.name AS sub_category_name
       FROM custom_fields f
       LEFT JOIN categories c ON c.id = f.category_id
       LEFT JOIN categories sc ON sc.id = f.sub_category_id
       ORDER BY f.updated_at DESC
       LIMIT 500`,
    );
    for (const field of rows) {
      const optionRows = await query(
        `SELECT id, value, label, sort_order, is_active
         FROM custom_field_options
         WHERE field_id = $1 AND is_active = TRUE
         ORDER BY sort_order, label`,
        [field.id],
      );
      field.options = optionRows.rows;
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const adminUpsert = async (req, res, next) => {
  try {
    await ensureTables();
    const {
      id,
      category_id,
      sub_category_id,
      field_key,
      label,
      field_type = 'input',
      is_required = false,
      sort_order = 0,
      is_active = true,
      options = [],
    } = req.body || {};

    const cleanLabel = String(label || '').trim();
    const cleanKey = makeKey(field_key || cleanLabel);
    const cleanType = normalizeFieldType(field_type);

    if (!category_id || !cleanKey || !cleanLabel) {
      return res.status(422).json({ success: false, message: 'Kategori ve alan adı gerekli.' });
    }

    const cleanOptions = Array.isArray(options)
      ? options
          .map((o) => ({
            value: String(o?.value || '').trim(),
            label: String(o?.label || o?.value || '').trim(),
            sort_order: Number(o?.sort_order || 0),
            is_active: o?.is_active !== false,
          }))
          .filter((o) => o.value && o.label)
      : [];

    const saved = await withTransaction(async (client) => {
      let field;

      if (id) {
        const { rows } = await client.query(
          `UPDATE custom_fields SET
              category_id = $1,
              sub_category_id = $2,
              field_key = $3,
               label = $4,
               field_type = $5,
               is_required = $6,
               sort_order = $7,
              is_active = $8,
              updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
          [
            category_id,
            sub_category_id || null,
            cleanKey,
            cleanLabel,
            cleanType,
            !!is_required,
            Number(sort_order || 0),
            !!is_active,
            id,
          ],
        );
        field = rows[0];
      } else {
        const existing = sub_category_id
          ? await client.query(
              `SELECT id
               FROM custom_fields
               WHERE category_id = $1
                 AND sub_category_id = $2
                 AND field_key = $3
               LIMIT 1`,
              [category_id, sub_category_id, cleanKey],
            )
          : await client.query(
              `SELECT id
               FROM custom_fields
               WHERE category_id = $1
                 AND sub_category_id IS NULL
                 AND field_key = $2
               LIMIT 1`,
              [category_id, cleanKey],
            );

        const { rows } = await client.query(
          existing.rows.length
            ? `UPDATE custom_fields SET
                 label = $1,
                 field_type = $2,
                 is_required = $3,
                 sort_order = $4,
                 is_active = $5,
                 updated_at = NOW()
               WHERE id = $6
               RETURNING *`
            : `INSERT INTO custom_fields
                 (id, category_id, sub_category_id, field_key, label, field_type, is_required, sort_order, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
               RETURNING *`,
          existing.rows.length
            ? [
                cleanLabel,
                cleanType,
                !!is_required,
                Number(sort_order || 0),
                !!is_active,
                existing.rows[0].id,
              ]
            : [
                crypto.randomUUID(),
                category_id,
                sub_category_id || null,
                cleanKey,
                cleanLabel,
                cleanType,
                !!is_required,
                Number(sort_order || 0),
                !!is_active,
              ],
        );
        field = rows[0];
      }

      // Replace options for select fields.
      await client.query('UPDATE custom_field_options SET is_active = FALSE, updated_at = NOW() WHERE field_id = $1', [field.id]);

      if (OPTION_FIELD_TYPES.has(field.field_type)) {
        for (const opt of cleanOptions) {
          const existingOption = await client.query(
            'SELECT id FROM custom_field_options WHERE field_id = $1 AND value = $2 LIMIT 1',
            [field.id, opt.value],
          );

          if (existingOption.rows.length) {
            await client.query(
              `UPDATE custom_field_options
               SET label = $2,
                   sort_order = $3,
                   is_active = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [existingOption.rows[0].id, opt.label, opt.sort_order, opt.is_active],
            );
          } else {
            await client.query(
              `INSERT INTO custom_field_options (id, field_id, value, label, sort_order, is_active)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [crypto.randomUUID(), field.id, opt.value, opt.label, opt.sort_order, opt.is_active],
            );
          }
        }
      }

      const optRows = await client.query(
        `SELECT id, value, label, sort_order, is_active
         FROM custom_field_options
         WHERE field_id = $1 AND is_active = TRUE
         ORDER BY sort_order, label`,
        [field.id],
      );

      return { ...field, options: optRows.rows };
    });

    res.json({ success: true, message: 'Alan kaydedildi.', data: saved });
  } catch (err) {
    next(err);
  }
};

const adminDelete = async (req, res, next) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE custom_fields SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Alan bulunamadı.' });
    res.json({ success: true, message: 'Alan silindi.', data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const upsertListingCustomFields = async (client, listingId, customFields = []) => {
  if (!Array.isArray(customFields) || !customFields.length) return;

  // Expect: [{ field_id, value }]
  for (const item of customFields) {
    const fieldId = String(item?.field_id || '').trim();
    if (!fieldId) continue;
    const value = item?.value;

    // Determine field type and place value in correct column
    const fieldRow = await client.query('SELECT field_type FROM custom_fields WHERE id = $1 AND is_active = TRUE', [fieldId]);
    if (!fieldRow.rows.length) continue;
    const type = fieldRow.rows[0].field_type;

    let valueText = null;
    let valueNumber = null;
    let valueBool = null;

    if (type === 'number') valueNumber = value === '' || value == null ? null : Number(value);
    else if (type === 'boolean' || type === 'checkbox') valueBool = value === true || value === 'true' || value === 1 || value === '1';
    else if (type === 'multi_select') valueText = Array.isArray(value) ? JSON.stringify(value) : value == null ? null : String(value);
    else valueText = value == null ? null : String(value);

    const existing = await client.query(
      'SELECT 1 FROM listing_custom_fields WHERE listing_id = $1 AND field_id = $2 LIMIT 1',
      [listingId, fieldId],
    );

    if (existing.rows.length) {
      await client.query(
        `UPDATE listing_custom_fields
         SET value_text = $3,
             value_number = $4,
             value_bool = $5,
             updated_at = NOW()
         WHERE listing_id = $1 AND field_id = $2`,
        [listingId, fieldId, valueText, valueNumber, valueBool],
      );
    } else {
      await client.query(
        `INSERT INTO listing_custom_fields (listing_id, field_id, value_text, value_number, value_bool)
         VALUES ($1,$2,$3,$4,$5)`,
        [listingId, fieldId, valueText, valueNumber, valueBool],
      );
    }
  }
};

module.exports = {
  ensureTables,
  getCustomFields,
  adminList,
  adminUpsert,
  adminDelete,
  upsertListingCustomFields,
};
