const { query } = require('../config/database');
const {
  refreshExpiredPromotions,
  createPromotionOrder,
} = require('../services/promotion.service');

const getPackages = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM promotion_packages WHERE is_active = TRUE ORDER BY sort_order',
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const purchasePromotion = async (req, res, next) => {
  try {
    const order = await createPromotionOrder({
      listingId: req.body.listing_id,
      packageId: req.body.package_id,
      userId: req.user.id,
      userNote: req.body.user_note,
    });

    res.status(201).json({
      success: true,
      message: 'Ödeme talimatı oluşturuldu. Havale sonrası admin onayı bekleniyor.',
      data: {
        order,
        bank: {
          bank_name: order.bank_name,
          iban: order.iban,
          iban_owner: order.iban_owner,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT po.*, pp.name AS package_name, pp.label AS package_label, pp.type AS package_type,
              pp.duration_days, l.title AS listing_title
       FROM promotion_orders po
       JOIN promotion_packages pp ON pp.id = po.package_id
       JOIN listings l ON l.id = po.listing_id
       WHERE po.id = $1 AND po.user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Ödeme talimatı bulunamadı.' });
    }
    res.json({
      success: true,
      data: rows[0],
      bank: {
        bank_name: rows[0].bank_name,
        iban: rows[0].iban,
        iban_owner: rows[0].iban_owner,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getMyPromotions = async (req, res, next) => {
  try {
    await refreshExpiredPromotions();
    const [orders, promotions] = await Promise.all([
      query(
        `SELECT po.*, pp.name AS package_name, pp.label AS package_label, l.title AS listing_title
         FROM promotion_orders po
         JOIN promotion_packages pp ON pp.id = po.package_id
         JOIN listings l ON l.id = po.listing_id
         WHERE po.user_id = $1
         ORDER BY po.created_at DESC`,
        [req.user.id],
      ),
      query(
        `SELECT lp.*, pp.name AS package_name, pp.label AS package_label, l.title AS listing_title
         FROM listing_promotions lp
         JOIN promotion_packages pp ON pp.id = lp.package_id
         JOIN listings l ON l.id = lp.listing_id
         WHERE lp.user_id = $1
         ORDER BY lp.created_at DESC`,
        [req.user.id],
      ),
    ]);
    res.json({ success: true, data: { orders: orders.rows, promotions: promotions.rows } });
  } catch (err) {
    next(err);
  }
};

const handleWebhook = async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Online ödeme webhook kapalı. Havale/EFT ödemeleri admin panelinden onaylanır.',
  });
};

module.exports = { getPackages, purchasePromotion, getOrder, handleWebhook, getMyPromotions };
