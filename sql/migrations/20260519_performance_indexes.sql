-- Performance indexes for critical queries
-- Run: psql -h localhost -p 55432 -U postgres -d ilango_db -f sql/migrations/20260519_performance_indexes.sql

-- Categories: fast slug lookup, parent traversal
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active_parent ON categories(is_active, parent_id);

-- Listings: fast category lookup, user listings, search
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_sub_category_id ON listings(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category_status ON listings(category_id, status);

-- Listing images: fast image lookup by listing
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_images_primary ON listing_images(listing_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_listing_images_sort ON listing_images(listing_id, sort_order);

-- Custom fields: fast field lookup by category
CREATE INDEX IF NOT EXISTS idx_custom_fields_category_id ON custom_fields(category_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_fields(is_active, category_id);

-- Listing field values: fast lookup
CREATE INDEX IF NOT EXISTS idx_listing_field_values_listing ON listing_field_values(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_field_values_field ON listing_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_listing_field_values_lookup ON listing_field_values(listing_id, field_id);

-- Custom field options: fast lookup
CREATE INDEX IF NOT EXISTS idx_custom_field_options_field ON custom_field_options(field_id);

-- Users: auth and profile lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Messages: conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Favorites: user favorites lookup
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_listing ON favorites(user_id, listing_id);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_categories_active_idx ON categories(id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_custom_fields_active_idx ON custom_fields(id) WHERE is_active = true;

-- Composite index for category tree queries
CREATE INDEX IF NOT EXISTS idx_categories_tree ON categories(is_active, parent_id, sort_order);

-- Composite index for listing queries with category filter
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings(category_id, status, created_at DESC);

VACUUM ANALYZE;
