CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(160) NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  href TEXT DEFAULT '/ilanlar',
  placement VARCHAR(40) NOT NULL DEFAULT 'home_hero',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO banners (title, subtitle, image_url, href, placement, sort_order, is_active)
SELECT title, subtitle, image_url, href, placement, sort_order, TRUE
FROM (
  VALUES
    (
      'Araçta doğru marka, model ve paketle hızlı satış',
      'BMW X5 xDrive gibi net hiyerarşiyle ilanını doğru alıcıya göster.',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=78',
      '/ilanlar?kategori=arac',
      'home_hero',
      -30
    ),
    (
      'Telefon ve elektronik fırsatlarını güvenle keşfet',
      'Model, seri ve depolama seçenekleriyle aradığın ürünü daha hızlı bul.',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=78',
      '/ilanlar?kategori=telefon',
      'home_hero',
      -20
    ),
    (
      'Ev, yaşam ve günlük ihtiyaçlar tek vitrinde',
      'Gerçek ilanlar, güçlü filtreler ve aktif kategori yapısıyla Satgo vitrini.',
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1600&q=78',
      '/ilanlar',
      'home_hero',
      -10
    )
) AS seed(title, subtitle, image_url, href, placement, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM banners b
  WHERE b.title = seed.title AND b.placement = seed.placement
);
