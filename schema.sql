-- ============================================================
-- ilanGO - PostgreSQL Database Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'banned', 'pending');
CREATE TYPE listing_status AS ENUM ('active', 'passive', 'sold', 'pending', 'rejected');
CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
CREATE TYPE promotion_type AS ENUM ('featured', 'urgent', 'showcase', 'boost');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE promotion_order_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
CREATE TYPE report_reason AS ENUM ('fake', 'spam', 'offensive', 'wrong_category', 'sold', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- fuel types for vehicles
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'lpg', 'electric', 'hybrid');
CREATE TYPE transmission_type AS ENUM ('automatic', 'manual', 'semi_automatic');
CREATE TYPE body_type AS ENUM ('sedan', 'hatchback', 'suv', 'coupe', 'convertible', 'wagon', 'van', 'pickup', 'minivan');
CREATE TYPE real_estate_type AS ENUM ('sale', 'rent');
CREATE TYPE heating_type AS ENUM ('central', 'floor', 'stove', 'electric', 'gas', 'solar', 'none');

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  phone           VARCHAR(20),
  password_hash   TEXT NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  role            user_role NOT NULL DEFAULT 'user',
  status          user_status NOT NULL DEFAULT 'active',
  city            VARCHAR(100),
  district        VARCHAR(100),
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  email_verify_token  TEXT,
  phone_verify_code   VARCHAR(6),
  reset_token         TEXT,
  reset_token_expires TIMESTAMPTZ,
  rating_avg      NUMERIC(3,2) DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  listing_count   INTEGER DEFAULT 0,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_city ON users(city);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  icon        VARCHAR(10),
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Seed main categories
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Araç',        'arac',        '🚗', 1),
  ('Motor',       'motor',       '🏍', 2),
  ('Emlak',       'emlak',       '🏠', 3),
  ('Elektronik',  'elektronik',  '📱', 4),
  ('Ev Eşyası',   'ev-esyasi',   '🛋', 5),
  ('Giyim',       'giyim',       '👕', 6),
  ('Hizmet',      'hizmet',      '🔧', 7),
  ('İş İlanları', 'is-ilanlari', '💼', 8),
  ('Spor',        'spor',        '⚽', 9),
  ('Diğer',       'diger',       '📦', 10);

-- Sub-categories for Araç
INSERT INTO categories (parent_id, name, slug, sort_order) VALUES
  (1, 'Otomobil',    'otomobil',    1),
  (1, 'SUV & 4x4',   'suv',         2),
  (1, 'Ticari Araç', 'ticari-arac', 3),
  (1, 'Klasik',      'klasik',      4);

-- Sub-categories for Emlak
INSERT INTO categories (parent_id, name, slug, sort_order) VALUES
  (3, 'Konut',           'konut',           1),
  (3, 'İş Yeri',         'is-yeri',         2),
  (3, 'Arsa & Tarla',    'arsa',            3),
  (3, 'Devren Kiralık',  'devren-kiralik',  4);

-- ============================================================
-- LISTINGS TABLE (core)
-- ============================================================

CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  sub_category_id INTEGER REFERENCES categories(id),

  -- Core fields
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  price           NUMERIC(15,2),
  price_negotiable BOOLEAN DEFAULT FALSE,
  condition       listing_condition DEFAULT 'good',
  status          listing_status NOT NULL DEFAULT 'pending',

  -- Location
  city            VARCHAR(100),
  district        VARCHAR(100),
  neighborhood    VARCHAR(100),
  latitude        NUMERIC(10,8),
  longitude       NUMERIC(11,8),

  -- Dynamic category hierarchy selected while creating the listing
  hierarchy_group  VARCHAR(80),
  hierarchy_path   TEXT[] NOT NULL DEFAULT '{}',
  hierarchy_labels TEXT[] NOT NULL DEFAULT '{}',

  -- Promotion flags (denormalized for query performance)
  is_featured     BOOLEAN DEFAULT FALSE,
  is_urgent       BOOLEAN DEFAULT FALSE,
  is_showcase     BOOLEAN DEFAULT FALSE,
  featured_until  TIMESTAMPTZ,
  urgent_until    TIMESTAMPTZ,
  showcase_until  TIMESTAMPTZ,
  boosted_at      TIMESTAMPTZ,

  -- Stats
  view_count      INTEGER DEFAULT 0,
  favorite_count  INTEGER DEFAULT 0,
  message_count   INTEGER DEFAULT 0,

  -- Approval
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_user ON listings(user_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_listings_hierarchy_group ON listings(hierarchy_group);
CREATE INDEX idx_listings_featured ON listings(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_listings_showcase ON listings(is_showcase) WHERE is_showcase = TRUE;
-- Full text search index
CREATE INDEX idx_listings_fts ON listings USING GIN(to_tsvector('turkish', title || ' ' || COALESCE(description, '')));

-- ============================================================
-- LISTING IMAGES
-- ============================================================

CREATE TABLE listing_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_images_listing ON listing_images(listing_id);

-- ============================================================
-- VEHICLE DETAILS (for Araç category)
-- ============================================================

CREATE TABLE vehicle_details (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  brand           VARCHAR(100),
  model           VARCHAR(100),
  year            SMALLINT,
  mileage         INTEGER,          -- km
  fuel_type       fuel_type,
  transmission    transmission_type,
  body_type       body_type,
  color           VARCHAR(50),
  drive_type      VARCHAR(40),
  type_name       VARCHAR(120),
  engine_cc       SMALLINT,         -- engine displacement cm3
  horse_power     SMALLINT,
  doors           SMALLINT,
  seats           SMALLINT,
  has_warranty    BOOLEAN DEFAULT FALSE,
  warranty_remaining VARCHAR(120),
  has_lpg         BOOLEAN DEFAULT FALSE,
  has_damage_record BOOLEAN DEFAULT FALSE,
  tramer_record   VARCHAR(40),
  lien_pledge_status VARCHAR(40),
  damage_detail   TEXT,
  trade_in        BOOLEAN DEFAULT FALSE,
  plate_city      VARCHAR(10),      -- '34 İstanbul'
  plate_type      VARCHAR(40),
  plate_number    VARCHAR(20),
  chassis_last6   VARCHAR(6),
  legal_brand     VARCHAR(100),
  commercial_name VARCHAR(120),
  legal_model_year SMALLINT,
  series          VARCHAR(100),
  package_name    VARCHAR(100),
  trim_name       VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MOTORCYCLE DETAILS (for Motor category)
-- ============================================================

CREATE TABLE motorcycle_details (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  brand           VARCHAR(100),
  model           VARCHAR(100),
  year            SMALLINT,
  mileage         INTEGER,
  engine_cc       SMALLINT,
  license_class   VARCHAR(10),      -- A, A1, A2, B
  color           VARCHAR(50),
  condition_detail VARCHAR(100),
  trade_in        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REAL ESTATE DETAILS (for Emlak category)
-- ============================================================

CREATE TABLE real_estate_details (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  listing_type    real_estate_type NOT NULL DEFAULT 'sale',
  size_m2         INTEGER,
  room_count      VARCHAR(20),       -- '3+1', '2+1', 'Stüdyo'
  building_age    SMALLINT,
  floor           SMALLINT,
  total_floors    SMALLINT,
  heating         heating_type,
  is_furnished    BOOLEAN DEFAULT FALSE,
  has_balcony     BOOLEAN DEFAULT FALSE,
  has_parking     BOOLEAN DEFAULT FALSE,
  has_elevator    BOOLEAN DEFAULT FALSE,
  monthly_dues    NUMERIC(10,2),     -- aidat
  deposit         NUMERIC(15,2),     -- depozito
  deed_type       VARCHAR(50),       -- tapu türü
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FAVORITES TABLE
-- ============================================================

CREATE TABLE favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_listing ON favorites(listing_id);

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  buyer_unread    INTEGER DEFAULT 0,
  seller_unread   INTEGER DEFAULT 0,
  is_blocked      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

CREATE INDEX idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX idx_conversations_seller ON conversations(seller_id);
CREATE INDEX idx_conversations_listing ON conversations(listing_id);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  status          message_status NOT NULL DEFAULT 'sent',
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ============================================================
-- PROMOTION PACKAGES (admin-managed)
-- ============================================================

CREATE TABLE promotion_packages (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  label         VARCHAR(100),
  code          VARCHAR(50) UNIQUE NOT NULL,
  type          promotion_type NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default packages
INSERT INTO promotion_packages (name, label, code, type, description, price, duration_days, sort_order) VALUES
  ('Günlük Öne Çıkarma',   'Günlük öne çıkarma',   'daily_featured',  'featured', 'İlan 1 gün boyunca öne çıkanlarda görünür.',        19.00, 1, 1),
  ('Haftalık Öne Çıkarma', 'Haftalık öne çıkarma', 'weekly_featured', 'featured', 'İlan 7 gün boyunca öne çıkanlarda görünür.',        89.00, 7, 2),
  ('Acil İlan',            'Acil ilan',            'urgent',          'urgent',   'İlana acil rozeti eklenir.',                       39.00, 7, 3),
  ('Vitrin İlanı',         'Vitrin ilanı',         'showcase',        'showcase', 'İlan ana sayfa vitrin alanında görünür.',          129.00, 7, 4),
  ('Tekli İlan Yükseltme', 'Tekli ilan yükseltme', 'single_boost',    'boost',    'İlan bir defaya mahsus listede yukarı taşınır.',     24.00, 1, 5);

-- ============================================================
-- LISTING PROMOTIONS (purchase records)
-- ============================================================

CREATE TABLE listing_promotions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id      INTEGER NOT NULL REFERENCES promotion_packages(id),
  type            promotion_type NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  payment_status  payment_status NOT NULL DEFAULT 'pending',
  payment_ref     TEXT,            -- external payment reference
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotions_listing ON listing_promotions(listing_id);
CREATE INDEX idx_promotions_user ON listing_promotions(user_id);
CREATE INDEX idx_promotions_payment ON listing_promotions(payment_status);
CREATE INDEX idx_listing_promotions_active ON listing_promotions(listing_id, ends_at)
  WHERE payment_status = 'completed' AND status = 'active';

-- ============================================================
-- PROMOTION ORDERS (bank transfer approval flow)
-- ============================================================

CREATE TABLE promotion_orders (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id           UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id           INTEGER NOT NULL REFERENCES promotion_packages(id),
  amount               NUMERIC(10,2) NOT NULL,
  status               promotion_order_status NOT NULL DEFAULT 'pending',
  payment_method       VARCHAR(20) NOT NULL DEFAULT 'bank_transfer',
  bank_name            TEXT,
  iban                 TEXT,
  iban_owner           TEXT,
  payment_code         VARCHAR(40) UNIQUE NOT NULL,
  user_note            TEXT,
  admin_note           TEXT,
  approved_by          UUID REFERENCES users(id),
  approved_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  created_promotion_id UUID REFERENCES listing_promotions(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotion_orders_user ON promotion_orders(user_id);
CREATE INDEX idx_promotion_orders_listing ON promotion_orders(listing_id);
CREATE INDEX idx_promotion_orders_status ON promotion_orders(status);
CREATE INDEX idx_promotion_orders_created ON promotion_orders(created_at DESC);

-- ============================================================
-- PAYMENT SETTINGS (admin-managed bank transfer details)
-- ============================================================

CREATE TABLE payment_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name   TEXT NOT NULL,
  iban        TEXT NOT NULL,
  iban_owner  TEXT NOT NULL,
  updated_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listing_promotions
  ADD COLUMN order_id UUID REFERENCES promotion_orders(id);

CREATE INDEX idx_listing_promotions_order ON listing_promotions(order_id);

-- ============================================================
-- REPORTS / COMPLAINTS
-- ============================================================

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      report_reason NOT NULL,
  description TEXT,
  status      report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, reporter_id)
);

CREATE INDEX idx_reports_listing ON reports(listing_id);
CREATE INDEX idx_reports_status ON reports(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,  -- 'new_message', 'listing_approved', 'promotion_expiring', etc.
  title       VARCHAR(200),
  body        TEXT,
  data        JSONB,                 -- extra data (listing_id, etc.)
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- REFRESH TOKENS
-- ============================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-UPDATE promotion flags on listings
-- ============================================================

CREATE OR REPLACE FUNCTION sync_listing_promotions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed'
     AND NEW.status = 'active'
     AND (NEW.ends_at IS NULL OR NEW.ends_at > NOW()) THEN
    IF NEW.type = 'featured' THEN
      UPDATE listings SET is_featured = TRUE, featured_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'urgent' THEN
      UPDATE listings SET is_urgent = TRUE, urgent_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'showcase' THEN
      UPDATE listings SET is_showcase = TRUE, showcase_until = NEW.ends_at WHERE id = NEW.listing_id;
    ELSIF NEW.type = 'boost' THEN
      UPDATE listings SET boosted_at = NOW() WHERE id = NEW.listing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_promotions
  AFTER INSERT OR UPDATE ON listing_promotions
  FOR EACH ROW EXECUTE FUNCTION sync_listing_promotions();

-- ============================================================
-- AUTO-UPDATE favorite_count on listings
-- ============================================================

CREATE OR REPLACE FUNCTION update_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET favorite_count = favorite_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_favorite_count
  AFTER INSERT OR DELETE ON favorites
  FOR EACH ROW EXECUTE FUNCTION update_favorite_count();
