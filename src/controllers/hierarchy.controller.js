const multer = require('multer');
const { query } = require('../config/database');

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const DEFAULT_PATHS = {
  vehicle: [
    ['BMW', 'X3', 'xDrive', 'M Sport'],
    ['BMW', 'X5', 'xDrive', 'M Sport'],
    ['BMW', 'X5', 'xDrive', 'Executive'],
    ['Mercedes-Benz', 'C180', 'AMG', 'Premium'],
    ['Mercedes-Benz', 'E200', 'Exclusive', 'Premium'],
    ['Volkswagen', 'Golf', 'Life', '1.5 eTSI'],
    ['Volkswagen', 'Passat', 'Elegance', '1.5 TSI'],
    ['Renault', 'Clio', 'Joy', '1.0 TCe'],
    ['Fiat', 'Egea', 'Easy', '1.4 Fire'],
    ['Toyota', 'Corolla', 'Dream', 'Hybrid'],
    ['Ford', 'Focus', 'Titanium', 'EcoBoost'],
    ['Togg', 'T10X', 'V2', 'Uzun Menzil'],
  ],
  motor: [
    ['Honda', 'PCX 125', 'Standart', 'ABS'],
    ['Honda', 'Forza 250', 'Touring', 'ABS'],
    ['Yamaha', 'NMAX 125', 'Urban', 'ABS'],
    ['Yamaha', 'XMAX 250', 'Tech Max', 'ABS'],
    ['BMW Motorrad', 'R 1250 GS', 'Adventure', 'Triple Black'],
    ['Kawasaki', 'Ninja 400', 'Performance', 'KRT'],
  ],
  elektronik: [
    ['Telefon', 'Apple', 'iPhone 15', 'Pro'],
    ['Telefon', 'Apple', 'iPhone 14', 'Pro Max'],
    ['Telefon', 'Samsung', 'Galaxy S24', 'Ultra'],
    ['Telefon', 'Xiaomi', 'Redmi Note 13', 'Pro'],
    ['Bilgisayar', 'Apple', 'MacBook Pro', 'M3'],
    ['Bilgisayar', 'Lenovo', 'ThinkPad', 'T Serisi'],
    ['Bilgisayar', 'Asus', 'ROG', 'Gaming'],
    ['Oyun Konsolu', 'Sony', 'PlayStation 5', 'Slim'],
    ['Tablet', 'Apple', 'iPad Air', 'M2'],
  ],
  emlak: [
    ['Konut', 'Satılık', 'Daire', 'Site İçi'],
    ['Konut', 'Kiralık', 'Daire', 'Eşyalı'],
    ['Konut', 'Satılık', 'Villa', 'Müstakil'],
    ['İş Yeri', 'Kiralık', 'Ofis', 'Plaza'],
    ['İş Yeri', 'Satılık', 'Dükkan', 'Cadde Üzeri'],
    ['Arsa & Tarla', 'Satılık', 'İmarlı', 'Konut İmarlı'],
  ],
  'ev-esyasi': [
    ['Beyaz Eşya', 'Buzdolabı', 'No Frost'],
    ['Beyaz Eşya', 'Çamaşır Makinesi', '9 kg'],
    ['Mobilya', 'Koltuk Takımı', 'Köşe Koltuk'],
    ['Mobilya', 'Yatak Odası', 'Gardırop'],
    ['Küçük Ev Aleti', 'Kahve Makinesi', 'Tam Otomatik'],
  ],
  giyim: [
    ['Kadın', 'Ayakkabı', 'Spor'],
    ['Kadın', 'Çanta', 'Omuz Çantası'],
    ['Erkek', 'Mont', 'Kışlık'],
    ['Erkek', 'Ayakkabı', 'Sneaker'],
    ['Çocuk', 'Giyim', 'Takım'],
  ],
  hizmet: [
    ['Tamir & Bakım', 'Elektrik', 'Ev'],
    ['Tamir & Bakım', 'Tesisat', 'Su'],
    ['Nakliye', 'Evden Eve', 'Şehir İçi'],
    ['Özel Ders', 'Matematik', 'Lise'],
    ['Temizlik', 'Ev Temizliği', 'Günlük'],
  ],
  'is-ilanlari': [
    ['Tam Zamanlı', 'Satış', 'Mağaza Danışmanı'],
    ['Tam Zamanlı', 'Yazılım', 'Frontend'],
    ['Part Time', 'Operasyon', 'Kurye'],
    ['Uzaktan', 'Tasarım', 'Grafik Tasarım'],
  ],
  spor: [
    ['Fitness', 'Kardiyo', 'Koşu Bandı'],
    ['Fitness', 'Ağırlık', 'Dambıl Seti'],
    ['Bisiklet', 'Dağ Bisikleti', '29 Jant'],
    ['Outdoor', 'Kamp', 'Çadır'],
    ['Futbol', 'Forma', 'Kulüp'],
  ],
  diger: [
    ['Koleksiyon', 'Antika', 'Obje'],
    ['Kitap', 'Roman', 'Türk Edebiyatı'],
    ['Hobi', 'Müzik Aleti', 'Gitar'],
    ['Bebek & Çocuk', 'Oyuncak', 'Eğitici'],
  ],
};

const ROOT_ALIASES = {
  vehicle: new Set(['arac', 'araç', 'otomobil', 'vasita', 'vehicle']),
  motor: new Set(['motor', 'motosiklet', 'motorcycle']),
  elektronik: new Set(['elektronik', 'telefon', 'bilgisayar']),
  emlak: new Set(['emlak', 'konut']),
  'ev-esyasi': new Set(['ev-esyasi', 'ev eşyası', 'ev esyasi']),
};

const makeSlug = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeGroup = (value) => {
  const group = makeSlug(value || 'vehicle');
  if (['arac', 'otomobil', 'vehicle'].includes(group)) return 'vehicle';
  if (['motor', 'motosiklet', 'motorcycle'].includes(group)) return 'motor';
  return group || 'vehicle';
};

const ensureTable = async () => {
  await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await query(`
    CREATE TABLE IF NOT EXISTS hierarchy_options (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_key VARCHAR(80) NOT NULL,
      parent_id UUID REFERENCES hierarchy_options(id) ON DELETE CASCADE,
      parent_key UUID GENERATED ALWAYS AS (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
      label VARCHAR(160) NOT NULL,
      slug VARCHAR(180) NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT hierarchy_options_unique_path UNIQUE (group_key, parent_key, slug)
    )
  `);
};

const upsertNode = async ({ groupKey, parentId = null, label, level = 0, sortOrder = 0 }) => {
  const cleanLabel = String(label || '').trim();
  if (!cleanLabel) return null;

  const slug = makeSlug(cleanLabel);
  const { rows } = await query(
    `INSERT INTO hierarchy_options (group_key, parent_id, label, slug, level, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE)
     ON CONFLICT ON CONSTRAINT hierarchy_options_unique_path DO UPDATE SET
       label = EXCLUDED.label,
       level = EXCLUDED.level,
       sort_order = EXCLUDED.sort_order,
       is_active = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [groupKey, parentId, cleanLabel, slug, level, sortOrder],
  );

  return rows[0];
};

const importPath = async (groupKey, path, baseSortOrder = 0) => {
  let parentId = null;
  let current = null;
  let imported = 0;
  const cleanPath = path.map((item) => String(item || '').trim()).filter(Boolean);

  for (let index = 0; index < cleanPath.length; index += 1) {
    current = await upsertNode({
      groupKey,
      parentId,
      label: cleanPath[index],
      level: index,
      sortOrder: baseSortOrder + index,
    });
    parentId = current.id;
    imported += 1;
  }

  return imported;
};

const ensureDefaults = async (groupKey) => {
  const defaults = DEFAULT_PATHS[groupKey];
  if (!defaults) return;

  const { rows } = await query('SELECT COUNT(*)::int AS count FROM hierarchy_options WHERE group_key = $1', [groupKey]);
  if (rows[0].count > 0) return;

  for (let index = 0; index < defaults.length; index += 1) {
    await importPath(groupKey, defaults[index], index * 10);
  }
};

const buildTree = (rows) => {
  const byId = new Map();
  const roots = [];

  rows.forEach((row) => byId.set(row.id, { ...row, children: [] }));
  rows.forEach((row) => {
    const node = byId.get(row.id);
    if (row.parent_id && byId.has(row.parent_id)) byId.get(row.parent_id).children.push(node);
    else roots.push(node);
  });

  return roots;
};

const parseCsvLine = (line) => {
  const result = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  result.push(value.trim());
  return result;
};

const normalizeImportPath = (groupKey, parts) => {
  let path = parts
    .flatMap((part) => String(part || '').split('>'))
    .map((part) => part.trim())
    .filter(Boolean);

  if (path.length && ROOT_ALIASES[groupKey]?.has(path[0].toLocaleLowerCase('tr-TR'))) {
    path = path.slice(1);
  }

  return path;
};

const parseCsv = (csv, groupKey) => {
  const lines = String(csv || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]).map((item) => makeSlug(item));
  const hasHeader = first.some((item) => ['path', 'level1', 'marka', 'brand', 'kategori'].includes(item));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const header = hasHeader ? first : [];

  return dataLines
    .map((line) => {
      const columns = parseCsvLine(line);
      if (header.includes('path')) return normalizeImportPath(groupKey, [columns[header.indexOf('path')]]);
      return normalizeImportPath(groupKey, columns);
    })
    .filter((path) => path.length);
};

const getHierarchy = async (req, res, next) => {
  try {
    await ensureTable();
    const groupKey = normalizeGroup(req.query.group || req.query.group_key || 'vehicle');
    await ensureDefaults(groupKey);

    const { rows } = await query(
      `SELECT *
       FROM hierarchy_options
       WHERE group_key = $1 AND is_active = TRUE
       ORDER BY level ASC, sort_order ASC, label ASC`,
      [groupKey],
    );

    res.json({ success: true, data: buildTree(rows) });
  } catch (err) {
    next(err);
  }
};

const createNode = async (req, res, next) => {
  try {
    await ensureTable();
    const groupKey = normalizeGroup(req.body.group_key);
    const parentId = req.body.parent_id || null;
    let level = 0;

    if (parentId) {
      const parent = await query('SELECT level FROM hierarchy_options WHERE id = $1', [parentId]);
      if (!parent.rows.length) return res.status(404).json({ success: false, message: 'Üst kayıt bulunamadı.' });
      level = parent.rows[0].level + 1;
    }

    const node = await upsertNode({
      groupKey,
      parentId,
      label: req.body.label,
      level,
      sortOrder: Number(req.body.sort_order || 0),
    });

    if (!node) return res.status(422).json({ success: false, message: 'Ad gerekli.' });
    res.status(201).json({ success: true, data: node });
  } catch (err) {
    next(err);
  }
};

const updateNode = async (req, res, next) => {
  try {
    await ensureTable();
    const { label, sort_order, is_active } = req.body;
    const hasParent = Object.prototype.hasOwnProperty.call(req.body, 'parent_id');
    const parentId = req.body.parent_id || null;
    let nextLevel = null;

    if (hasParent) {
      const current = await query('SELECT group_key FROM hierarchy_options WHERE id = $1', [req.params.id]);
      if (!current.rows.length) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });

      if (parentId === req.params.id) {
        return res.status(422).json({ success: false, message: 'Kayıt kendisinin altına taşınamaz.' });
      }

      if (parentId) {
        const branch = await query(
          `WITH RECURSIVE branch AS (
             SELECT id FROM hierarchy_options WHERE id = $1
             UNION ALL
             SELECT child.id
             FROM hierarchy_options child
             JOIN branch parent ON child.parent_id = parent.id
           )
           SELECT 1 FROM branch WHERE id = $2 LIMIT 1`,
          [req.params.id, parentId],
        );
        if (branch.rows.length) {
          return res.status(422).json({ success: false, message: 'Kayıt kendi alt kaydının içine taşınamaz.' });
        }

        const parent = await query('SELECT level, group_key FROM hierarchy_options WHERE id = $1 AND is_active = TRUE', [parentId]);
        if (!parent.rows.length) return res.status(404).json({ success: false, message: 'Üst kayıt bulunamadı.' });
        if (parent.rows[0].group_key !== current.rows[0].group_key) {
          return res.status(422).json({ success: false, message: 'Kayıt farklı bir gruba taşınamaz.' });
        }
        nextLevel = parent.rows[0].level + 1;
      } else {
        nextLevel = 0;
      }
    }

    const slug = label ? makeSlug(label) : null;
    const { rows } = await query(
      `UPDATE hierarchy_options SET
         parent_id = CASE WHEN $1 THEN $2 ELSE parent_id END,
         level = COALESCE($3, level),
         label = COALESCE($4, label),
         slug = COALESCE($5, slug),
         sort_order = COALESCE($6, sort_order),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        hasParent,
        parentId,
        nextLevel,
        label || null,
        slug,
        sort_order === undefined ? null : Number(sort_order),
        is_active,
        req.params.id,
      ],
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });

    if (hasParent) {
      await query(
        `WITH RECURSIVE tree AS (
           SELECT id, level FROM hierarchy_options WHERE id = $1
           UNION ALL
           SELECT child.id, tree.level + 1
           FROM hierarchy_options child
           JOIN tree ON child.parent_id = tree.id
         )
         UPDATE hierarchy_options target
         SET level = tree.level, updated_at = NOW()
         FROM tree
         WHERE target.id = tree.id`,
        [req.params.id],
      );
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteNode = async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await query(
      `WITH RECURSIVE branch AS (
         SELECT id FROM hierarchy_options WHERE id = $1
         UNION ALL
         SELECT child.id
         FROM hierarchy_options child
         JOIN branch parent ON child.parent_id = parent.id
       )
       UPDATE hierarchy_options
       SET is_active = FALSE, updated_at = NOW()
       WHERE id IN (SELECT id FROM branch)
       RETURNING *`,
      [req.params.id],
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    res.json({ success: true, message: 'Kayıt silindi.', data: rows });
  } catch (err) {
    next(err);
  }
};

const importCsv = async (req, res, next) => {
  try {
    await ensureTable();
    const groupKey = normalizeGroup(req.body.group_key);
    const csv = req.file ? req.file.buffer.toString('utf8') : req.body.csv;
    const paths = parseCsv(csv, groupKey);
    if (!paths.length) return res.status(422).json({ success: false, message: 'CSV içinde aktarılacak kayıt bulunamadı.' });

    let imported = 0;
    for (let index = 0; index < paths.length; index += 1) {
      imported += await importPath(groupKey, paths[index], index * 10);
    }

    res.json({ success: true, message: 'CSV aktarıldı.', data: { paths: paths.length, imported } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadCsv,
  getHierarchy,
  createNode,
  updateNode,
  deleteNode,
  importCsv,
};
