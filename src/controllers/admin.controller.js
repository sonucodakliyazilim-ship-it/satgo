const { query, withTransaction } = require('../config/database');
const {
  getPaymentSettings,
  updatePaymentSettings,
  refreshExpiredPromotions,
  approvePromotionOrder,
  rejectPromotionOrder,
} = require('../services/promotion.service');

// GET /api/admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [users, listings, revenue, reports, todayUsers, todayListings, activePromos] =
      await Promise.all([
        query('SELECT COUNT(*) FROM users'),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'active'`),
        query(`SELECT COALESCE(SUM(price),0) AS total FROM listing_promotions WHERE payment_status = 'completed'`),
        query(`SELECT COUNT(*) FROM reports WHERE status = 'pending'`),
        query(`SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE`),
        query(`SELECT COUNT(*) FROM listings WHERE created_at >= CURRENT_DATE`),
        query(`SELECT COUNT(*) FROM listing_promotions WHERE payment_status = 'completed' AND ends_at > NOW()`),
      ]);

    res.json({
      success: true,
      data: {
        total_users:         parseInt(users.rows[0].count),
        active_listings:     parseInt(listings.rows[0].count),
        total_revenue:       parseFloat(revenue.rows[0].total),
        pending_reports:     parseInt(reports.rows[0].count),
        today_new_users:     parseInt(todayUsers.rows[0].count),
        today_new_listings:  parseInt(todayListings.rows[0].count),
        active_promotions:   parseInt(activePromos.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, search, status } = req.query;
    const PER_PAGE = 20;
    const offset = (page - 1) * PER_PAGE;
    const params = [];
    const conds  = [];
    let p = 1;

    if (search) { conds.push(`(name ILIKE $${p} OR email ILIKE $${p++})`); params.push(`%${search}%`); }
    if (status) { conds.push(`status = $${p++}`); params.push(status); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await query(
      `SELECT id, name, email, phone, role, status, city, listing_count,
              rating_avg, created_at
       FROM users ${where}
       ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, PER_PAGE, offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PATCH /api/admin/users/:id/status
const setUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' | 'banned' | 'pending'
    const { rows } = await query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, status',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// GET /api/admin/listings
const getListings = async (req, res, next) => {
  try {
    const { page = 1, status, search } = req.query;
    const PER_PAGE = 20;
    const offset = (page - 1) * PER_PAGE;
    const params = [];
    const conds  = [];
    let p = 1;

    if (status) { conds.push(`l.status = $${p++}`); params.push(status); }
    if (search) { conds.push(`l.title ILIKE $${p++}`); params.push(`%${search}%`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await query(
      `SELECT l.id, l.title, l.price, l.status, l.city, l.view_count,
              l.is_featured, l.is_urgent, l.created_at,
              u.name AS seller_name, u.email AS seller_email,
              c.name AS category_name
       FROM listings l
       JOIN users u ON u.id = l.user_id
       JOIN categories c ON c.id = l.category_id
       ${where}
       ORDER BY l.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, PER_PAGE, offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PATCH /api/admin/listings/:id/status
const setListingStatus = async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body;
    const approved = status === 'active';
    const { rows } = await query(
      `UPDATE listings SET
         status = $1::listing_status,
         rejection_reason = $2,
         approved_by = $3,
         approved_at = CASE WHEN $4::boolean THEN NOW() ELSE NULL END
       WHERE id = $5 RETURNING id, title, status`,
      [status, rejection_reason || null, req.user.id, approved, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// GET /api/admin/reports
const getReports = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const { rows } = await query(
      `SELECT r.*, l.title AS listing_title, l.price AS listing_price,
              u.name AS reporter_name, u.email AS reporter_email
       FROM reports r
       JOIN listings l ON l.id = r.listing_id
       JOIN users u ON u.id = r.reporter_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`,
      [status]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PATCH /api/admin/reports/:id
const resolveReport = async (req, res, next) => {
  try {
    const { status, admin_note } = req.body; // 'reviewed' | 'resolved' | 'dismissed'
    const { rows } = await query(
      `UPDATE reports SET
         status = $1, admin_note = $2,
         reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, admin_note || null, req.user.id, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// GET /api/admin/promotions
const getPromotions = async (req, res, next) => {
  try {
    await refreshExpiredPromotions();
    const { rows } = await query(
      `SELECT lp.*, pp.name AS package_name, pp.label AS package_label, l.title AS listing_title,
              u.name AS user_name, u.email AS user_email
       FROM listing_promotions lp
       JOIN promotion_packages pp ON pp.id = lp.package_id
       JOIN listings l ON l.id = lp.listing_id
       JOIN users u ON u.id = lp.user_id
       ORDER BY lp.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getPromotionOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = 'WHERE po.status = $1';
    }
    const { rows } = await query(
      `SELECT po.*, pp.name AS package_name, pp.label AS package_label, pp.type AS package_type, pp.duration_days,
              l.title AS listing_title, l.price AS listing_price,
              u.name AS user_name, u.email AS user_email
       FROM promotion_orders po
       JOIN promotion_packages pp ON pp.id = po.package_id
       JOIN listings l ON l.id = po.listing_id
       JOIN users u ON u.id = po.user_id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT 100`,
      params,
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const approveOrder = async (req, res, next) => {
  try {
    const result = await approvePromotionOrder({
      orderId: req.params.id,
      adminId: req.user.id,
      adminNote: req.body.admin_note,
    });
    res.json({ success: true, message: 'Ödeme onaylandı ve paket aktifleştirildi.', data: result });
  } catch (err) { next(err); }
};

const rejectOrder = async (req, res, next) => {
  try {
    const order = await rejectPromotionOrder({
      orderId: req.params.id,
      adminId: req.user.id,
      adminNote: req.body.admin_note,
    });
    res.json({ success: true, message: 'Ödeme reddedildi.', data: order });
  } catch (err) { next(err); }
};

const getPaymentInfo = async (req, res, next) => {
  try {
    const settings = await getPaymentSettings();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
};

const updatePaymentInfo = async (req, res, next) => {
  try {
    const settings = await updatePaymentSettings({
      bankName: req.body.bank_name,
      iban: req.body.iban,
      ibanOwner: req.body.iban_owner,
      adminId: req.user.id,
    });
    res.json({ success: true, message: 'Odeme bilgileri guncellendi.', data: settings });
  } catch (err) { next(err); }
};

// POST /api/admin/packages
const createPackage = async (req, res, next) => {
  try {
    const { name, type, description, price, duration_days, sort_order } = req.body;
    const { rows } = await query(
      `INSERT INTO promotion_packages (name, type, description, price, duration_days, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, description || null, price, duration_days, sort_order || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/admin/packages/:id
const updatePackage = async (req, res, next) => {
  try {
    const { name, price, duration_days, is_active, description } = req.body;
    const { rows } = await query(
      `UPDATE promotion_packages SET
         name          = COALESCE($1, name),
         price         = COALESCE($2, price),
         duration_days = COALESCE($3, duration_days),
         is_active     = COALESCE($4, is_active),
         description   = COALESCE($5, description),
         updated_at    = NOW()
       WHERE id = $6 RETURNING *`,
      [name, price, duration_days, is_active, description, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  getDashboard, getUsers, setUserStatus,
  getListings, setListingStatus,
  getReports, resolveReport,
  getPaymentInfo, updatePaymentInfo,
  getPromotions, getPromotionOrders, approveOrder, rejectOrder,
  createPackage, updatePackage,
};
