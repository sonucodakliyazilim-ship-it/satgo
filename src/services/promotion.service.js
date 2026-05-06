const { query, withTransaction } = require('../config/database');

const DEFAULT_BANK_INFO = {
  bank_name: process.env.BANK_NAME || 'Satgo Demo Bank',
  iban: process.env.IBAN || 'TR00 0000 0000 0000 0000 0000 00',
  iban_owner: process.env.IBAN_OWNER || 'Satgo Marketplace Ltd.',
};

const normalizeIban = (iban) => String(iban || '').replace(/[\s-]/g, '').toUpperCase();

const formatIban = (iban) => {
  const normalized = normalizeIban(iban);
  return normalized.match(/.{1,4}/g)?.join(' ') || '';
};

const ensurePaymentSettings = async (db = { query }) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      bank_name TEXT NOT NULL,
      iban TEXT NOT NULL,
      iban_owner TEXT NOT NULL,
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(
    `INSERT INTO payment_settings (id, bank_name, iban, iban_owner)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_BANK_INFO.bank_name, formatIban(DEFAULT_BANK_INFO.iban), DEFAULT_BANK_INFO.iban_owner],
  );
};

const getPaymentSettings = async (db = { query }) => {
  await ensurePaymentSettings(db);
  const { rows } = await db.query(
    `SELECT bank_name, iban, iban_owner, updated_by, created_at, updated_at
     FROM payment_settings
     WHERE id = 1`,
  );
  return rows[0];
};

const updatePaymentSettings = async ({ bankName, iban, ibanOwner, adminId }) => {
  const bank_name = String(bankName || '').trim();
  const iban_owner = String(ibanOwner || '').trim();
  const normalizedIban = normalizeIban(iban);

  if (!bank_name || !iban_owner || !normalizedIban) {
    const err = new Error('Banka, alici ad soyad ve IBAN alanlari zorunludur.');
    err.status = 400;
    throw err;
  }

  if (!/^TR[0-9A-Z]{24}$/.test(normalizedIban)) {
    const err = new Error('Gecerli bir Turkiye IBAN numarasi girin.');
    err.status = 400;
    throw err;
  }

  await ensurePaymentSettings();
  const { rows } = await query(
    `UPDATE payment_settings SET
       bank_name = $1,
       iban = $2,
       iban_owner = $3,
       updated_by = $4,
       updated_at = NOW()
     WHERE id = 1
     RETURNING bank_name, iban, iban_owner, updated_by, created_at, updated_at`,
    [bank_name, formatIban(normalizedIban), iban_owner, adminId],
  );
  return rows[0];
};

const makePaymentCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const token = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SATGO-${stamp}-${token}`;
};

const refreshExpiredPromotions = async () => {
  await query(
    `UPDATE listing_promotions
     SET status = 'expired'
     WHERE payment_status = 'completed'
       AND status = 'active'
       AND ends_at IS NOT NULL
       AND ends_at <= NOW()`,
  );

  await query(
    `UPDATE listings l SET
       is_featured = EXISTS (
         SELECT 1 FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'featured'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       featured_until = (
         SELECT MAX(lp.ends_at) FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'featured'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       is_urgent = EXISTS (
         SELECT 1 FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'urgent'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       urgent_until = (
         SELECT MAX(lp.ends_at) FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'urgent'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       is_showcase = EXISTS (
         SELECT 1 FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'showcase'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       showcase_until = (
         SELECT MAX(lp.ends_at) FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'showcase'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       ),
       boosted_at = (
         SELECT MAX(lp.starts_at) FROM listing_promotions lp
         WHERE lp.listing_id = l.id AND lp.type = 'boost'
           AND lp.payment_status = 'completed' AND lp.status = 'active'
           AND lp.ends_at > NOW()
       )`,
  );
};

const createPromotionOrder = async ({ listingId, packageId, userId, userNote }) => {
  return withTransaction(async (client) => {
    const listing = await client.query(
      'SELECT id, user_id, title, status FROM listings WHERE id = $1',
      [listingId],
    );
    if (!listing.rows.length) {
      const err = new Error('İlan bulunamadı.');
      err.status = 404;
      throw err;
    }
    if (listing.rows[0].user_id !== userId) {
      const err = new Error('Sadece kendi ilanınız için paket satın alabilirsiniz.');
      err.status = 403;
      throw err;
    }
    if (listing.rows[0].status !== 'active') {
      const err = new Error('Sadece aktif ilanlar için öne çıkarma paketi satın alınabilir.');
      err.status = 409;
      throw err;
    }

    const pkg = await client.query(
      'SELECT * FROM promotion_packages WHERE id = $1 AND is_active = TRUE',
      [packageId],
    );
    if (!pkg.rows.length) {
      const err = new Error('Paket bulunamadı.');
      err.status = 404;
      throw err;
    }

    const existing = await client.query(
      `SELECT id FROM promotion_orders
       WHERE listing_id = $1 AND user_id = $2 AND package_id = $3 AND status = 'pending'
       LIMIT 1`,
      [listingId, userId, packageId],
    );
    if (existing.rows.length) {
      const err = new Error('Bu ilan ve paket için bekleyen bir ödeme talimatı zaten var.');
      err.status = 409;
      throw err;
    }

    const paymentSettings = await getPaymentSettings(client);

    const order = await client.query(
      `INSERT INTO promotion_orders
         (listing_id, user_id, package_id, amount, bank_name, iban, iban_owner, payment_code, user_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        listingId,
        userId,
        packageId,
        pkg.rows[0].price,
        paymentSettings.bank_name,
        paymentSettings.iban,
        paymentSettings.iban_owner,
        makePaymentCode(),
        userNote || null,
      ],
    );

    return { ...order.rows[0], package: pkg.rows[0], listing: listing.rows[0] };
  });
};

const approvePromotionOrder = async ({ orderId, adminId, adminNote }) => {
  return withTransaction(async (client) => {
    const order = await client.query(
      `SELECT po.*, pp.type, pp.duration_days
       FROM promotion_orders po
       JOIN promotion_packages pp ON pp.id = po.package_id
       WHERE po.id = $1
       FOR UPDATE`,
      [orderId],
    );
    if (!order.rows.length) {
      const err = new Error('Ödeme kaydı bulunamadı.');
      err.status = 404;
      throw err;
    }
    if (order.rows[0].status !== 'pending') {
      const err = new Error('Bu ödeme kaydı zaten sonuçlandırılmış.');
      err.status = 409;
      throw err;
    }

    const row = order.rows[0];
    const promo = await client.query(
      `INSERT INTO listing_promotions
         (listing_id, user_id, package_id, order_id, type, price, payment_status, payment_ref,
          starts_at, ends_at, status, approved_by, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,NOW(),NOW() + ($8::INT * INTERVAL '1 day'),'active',$9,NOW())
       RETURNING *`,
      [
        row.listing_id,
        row.user_id,
        row.package_id,
        row.id,
        row.type,
        row.amount,
        row.payment_code,
        row.duration_days,
        adminId,
      ],
    );

    const updated = await client.query(
      `UPDATE promotion_orders SET
         status = 'approved',
         admin_note = $1,
         approved_by = $2,
         approved_at = NOW(),
         created_promotion_id = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [adminNote || null, adminId, promo.rows[0].id, row.id],
    );

    return { order: updated.rows[0], promotion: promo.rows[0] };
  });
};

const rejectPromotionOrder = async ({ orderId, adminId, adminNote }) => {
  const { rows } = await query(
    `UPDATE promotion_orders SET
       status = 'rejected',
       admin_note = $1,
       approved_by = $2,
       rejected_at = NOW(),
       updated_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [adminNote || null, adminId, orderId],
  );
  if (!rows.length) {
    const err = new Error('Bekleyen ödeme kaydı bulunamadı.');
    err.status = 404;
    throw err;
  }
  return rows[0];
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
  refreshExpiredPromotions,
  createPromotionOrder,
  approvePromotionOrder,
  rejectPromotionOrder,
};
