CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'banned', 'pending');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE listing_status AS ENUM ('active', 'passive', 'sold', 'pending', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_condition') THEN
    CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type') THEN
    CREATE TYPE promotion_type AS ENUM ('featured', 'urgent', 'showcase', 'boost');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_order_status') THEN
    CREATE TYPE promotion_order_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE report_reason AS ENUM ('fake', 'spam', 'offensive', 'wrong_category', 'sold', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fuel_type') THEN
    CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'lpg', 'electric', 'hybrid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transmission_type') THEN
    CREATE TYPE transmission_type AS ENUM ('automatic', 'manual', 'semi_automatic');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_type') THEN
    CREATE TYPE body_type AS ENUM ('sedan', 'hatchback', 'suv', 'coupe', 'convertible', 'wagon', 'van', 'pickup', 'minivan');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'real_estate_type') THEN
    CREATE TYPE real_estate_type AS ENUM ('sale', 'rent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'heating_type') THEN
    CREATE TYPE heating_type AS ENUM ('central', 'floor', 'stove', 'electric', 'gas', 'solar', 'none');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS phone_verify_code VARCHAR(6),
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS icon VARCHAR(10),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories(slug);

INSERT INTO categories (name, slug, icon, sort_order, is_active)
VALUES
  ('Arac', 'arac', 'car', 1, TRUE),
  ('Motor', 'motor', 'moto', 2, TRUE),
  ('Emlak', 'emlak', 'home', 3, TRUE),
  ('Elektronik', 'elektronik', 'tech', 4, TRUE),
  ('Ev Esyasi', 'ev-esyasi', 'home', 5, TRUE),
  ('Giyim', 'giyim', 'wear', 6, TRUE),
  ('Hizmet', 'hizmet', 'tool', 7, TRUE),
  ('Is Ilanlari', 'is-ilanlari', 'job', 8, TRUE),
  ('Spor', 'spor', 'ball', 9, TRUE),
  ('Diger', 'diger', 'box', 10, TRUE)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  user_id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO user_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'users'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF user_id_type IS NULL THEN
    RAISE EXCEPTION 'users.id column is required before core schema repair can run';
  END IF;

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS listings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      sub_category_id INTEGER REFERENCES categories(id),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      price NUMERIC(15,2),
      price_negotiable BOOLEAN DEFAULT FALSE,
      condition listing_condition DEFAULT 'good',
      status listing_status NOT NULL DEFAULT 'pending',
      city VARCHAR(100),
      district VARCHAR(100),
      neighborhood VARCHAR(100),
      latitude NUMERIC(10,8),
      longitude NUMERIC(11,8),
      is_featured BOOLEAN DEFAULT FALSE,
      is_urgent BOOLEAN DEFAULT FALSE,
      is_showcase BOOLEAN DEFAULT FALSE,
      featured_until TIMESTAMPTZ,
      urgent_until TIMESTAMPTZ,
      showcase_until TIMESTAMPTZ,
      boosted_at TIMESTAMPTZ,
      view_count INTEGER DEFAULT 0,
      favorite_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      approved_by %s REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type, user_id_type);

  EXECUTE format('ALTER TABLE listings ADD COLUMN IF NOT EXISTS approved_by %s REFERENCES users(id)', user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS favorites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, listing_id)
    )
  $sql$, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      buyer_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_message TEXT,
      last_message_at TIMESTAMPTZ,
      buyer_unread INTEGER DEFAULT 0,
      seller_unread INTEGER DEFAULT 0,
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(listing_id, buyer_id)
    )
  $sql$, user_id_type, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status message_status NOT NULL DEFAULT 'sent',
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS listing_promotions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id INTEGER,
      type promotion_type NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      payment_status payment_status NOT NULL DEFAULT 'pending',
      payment_ref TEXT,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      approved_by %s REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS promotion_orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id INTEGER,
      amount NUMERIC(10,2) NOT NULL,
      status promotion_order_status NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer',
      bank_name TEXT,
      iban TEXT,
      iban_owner TEXT,
      payment_code VARCHAR(40) UNIQUE NOT NULL,
      user_note TEXT,
      admin_note TEXT,
      approved_by %s REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      created_promotion_id UUID REFERENCES listing_promotions(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      reporter_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason report_reason NOT NULL,
      description TEXT,
      status report_status NOT NULL DEFAULT 'pending',
      reviewed_by %s REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(listing_id, reporter_id)
    )
  $sql$, user_id_type, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200),
      body TEXT,
      data JSONB,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS payment_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      bank_name TEXT NOT NULL,
      iban TEXT NOT NULL,
      iban_owner TEXT NOT NULL,
      updated_by %s REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, user_id_type);
END $$;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS price_negotiable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS condition listing_condition DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS status listing_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8),
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
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS vehicle_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  brand VARCHAR(100),
  model VARCHAR(100),
  year SMALLINT,
  mileage INTEGER,
  fuel_type fuel_type,
  transmission transmission_type,
  body_type body_type,
  color VARCHAR(50),
  engine_cc SMALLINT,
  horse_power SMALLINT,
  doors SMALLINT,
  seats SMALLINT,
  has_damage_record BOOLEAN DEFAULT FALSE,
  damage_detail TEXT,
  trade_in BOOLEAN DEFAULT FALSE,
  plate_city VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motorcycle_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  brand VARCHAR(100),
  model VARCHAR(100),
  year SMALLINT,
  mileage INTEGER,
  engine_cc SMALLINT,
  license_class VARCHAR(10),
  color VARCHAR(50),
  condition_detail VARCHAR(100),
  trade_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS real_estate_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  listing_type real_estate_type NOT NULL DEFAULT 'sale',
  size_m2 INTEGER,
  room_count VARCHAR(20),
  building_age SMALLINT,
  floor SMALLINT,
  total_floors SMALLINT,
  heating heating_type,
  is_furnished BOOLEAN DEFAULT FALSE,
  has_balcony BOOLEAN DEFAULT FALSE,
  has_parking BOOLEAN DEFAULT FALSE,
  has_elevator BOOLEAN DEFAULT FALSE,
  monthly_dues NUMERIC(10,2),
  deposit NUMERIC(15,2),
  deed_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  label VARCHAR(100),
  code VARCHAR(50) UNIQUE,
  type promotion_type,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE promotion_packages
  ADD COLUMN IF NOT EXISTS name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS type promotion_type,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE promotion_packages SET type = 'featured' WHERE type IS NULL;
ALTER TABLE promotion_packages ALTER COLUMN type SET NOT NULL;

WITH packages (name, label, code, type, description, price, duration_days, sort_order, is_active) AS (
  VALUES
    ('Daily Featured', 'Daily featured', 'daily_featured', 'featured'::promotion_type, 'Listing appears featured for 1 day.', 19.00, 1, 1, TRUE),
    ('Weekly Featured', 'Weekly featured', 'weekly_featured', 'featured'::promotion_type, 'Listing appears featured for 7 days.', 89.00, 7, 2, TRUE),
    ('Urgent Listing', 'Urgent listing', 'urgent', 'urgent'::promotion_type, 'Adds urgent badge to listing.', 39.00, 7, 3, TRUE),
    ('Showcase Listing', 'Showcase listing', 'showcase', 'showcase'::promotion_type, 'Listing appears in showcase area.', 129.00, 7, 4, TRUE),
    ('Single Boost', 'Single boost', 'single_boost', 'boost'::promotion_type, 'Moves listing higher once.', 24.00, 1, 5, TRUE)
)
INSERT INTO promotion_packages (name, label, code, type, description, price, duration_days, sort_order, is_active)
SELECT p.name, p.label, p.code, p.type, p.description, p.price, p.duration_days, p.sort_order, p.is_active
FROM packages p
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_packages existing WHERE existing.code = p.code
);

ALTER TABLE listing_promotions
  ADD COLUMN IF NOT EXISTS package_id INTEGER;

ALTER TABLE promotion_orders
  ADD COLUMN IF NOT EXISTS package_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listing_promotions_package_id_fkey'
      AND conrelid = 'listing_promotions'::regclass
  ) THEN
    ALTER TABLE listing_promotions
      ADD CONSTRAINT listing_promotions_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES promotion_packages(id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_orders_package_id_fkey'
      AND conrelid = 'promotion_orders'::regclass
  ) THEN
    ALTER TABLE promotion_orders
      ADD CONSTRAINT promotion_orders_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES promotion_packages(id) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_unique ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_listings_showcase ON listings(is_showcase) WHERE is_showcase = TRUE;
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_promotions_listing ON listing_promotions(listing_id);
CREATE INDEX IF NOT EXISTS idx_promotions_user ON listing_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotions_payment ON listing_promotions(payment_status);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_user ON promotion_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_listing ON promotion_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_status ON promotion_orders(status);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_created ON promotion_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_listing ON reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read) WHERE is_read = FALSE;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON listings;
CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON payment_settings;
CREATE TRIGGER trg_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

DROP TRIGGER IF EXISTS trg_favorite_count ON favorites;
CREATE TRIGGER trg_favorite_count
  AFTER INSERT OR DELETE ON favorites
  FOR EACH ROW EXECUTE FUNCTION update_favorite_count();
