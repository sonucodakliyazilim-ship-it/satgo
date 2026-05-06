INSERT INTO categories (name, slug, icon, sort_order)
VALUES
  ('Telefon', 'telefon', '📱', 11),
  ('Kişisel Bakım & Kozmetik', 'kisisel-bakim-kozmetik', '✨', 12),
  ('Anne & Bebek & Oyuncak', 'anne-bebek-oyuncak', '🧸', 13),
  ('Hobi & Kitap & Müzik', 'hobi-kitap-muzik', '🎸', 14),
  ('Ofis & Kırtasiye', 'ofis-kirtasiye', '🗂', 15),
  ('Spor & Outdoor', 'spor-outdoor', '🏕', 16),
  ('Diğer Araçlar', 'diger-araclar', '🚚', 17),
  ('Antika', 'antika', '🏺', 18),
  ('Pet Shop', 'pet-shop', '🐾', 19)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

WITH data(parent_slug, name, slug, sort_order) AS (
  VALUES
    ('telefon', 'iPhone iOS Telefon', 'iphone-ios-telefon', 1),
    ('telefon', 'Android Telefon', 'android-telefon', 2),
    ('telefon', 'Telefon Aksesuarları', 'telefon-aksesuarlari', 3),
    ('telefon', 'Telefon Yedek Parçaları', 'telefon-yedek-parcalari', 4),
    ('telefon', 'Diğer Cep Telefonları', 'diger-cep-telefonlari', 5),
    ('telefon', 'Telsiz & Masaüstü Telefon', 'telsiz-masaustu-telefon', 6),

    ('elektronik', 'Bilgisayar', 'bilgisayar', 1),
    ('elektronik', 'TV & Ses', 'tv-ses', 2),
    ('elektronik', 'Oyun & Konsol', 'oyun-konsol', 3),

    ('ev-esyasi', 'Mobilya', 'mobilya', 1),
    ('ev-esyasi', 'Beyaz Eşya', 'beyaz-esya', 2),
    ('ev-esyasi', 'Dekorasyon', 'dekorasyon', 3),

    ('motor', 'Motosiklet', 'motosiklet', 1),
    ('motor', 'Ekipman', 'motor-ekipman', 2),
    ('motor', 'Yedek Parça', 'motor-yedek-parca', 3),

    ('giyim', 'Kadın', 'kadin-giyim', 1),
    ('giyim', 'Erkek', 'erkek-giyim', 2),
    ('giyim', 'Aksesuar', 'giyim-aksesuar', 3),

    ('kisisel-bakim-kozmetik', 'Kozmetik', 'kozmetik', 1),
    ('kisisel-bakim-kozmetik', 'Kişisel Bakım', 'kisisel-bakim', 2),

    ('anne-bebek-oyuncak', 'Bebek', 'bebek', 1),
    ('anne-bebek-oyuncak', 'Oyuncak', 'oyuncak', 2),
    ('anne-bebek-oyuncak', 'Çocuk Giyim', 'cocuk-giyim', 3),

    ('hobi-kitap-muzik', 'Kitap', 'kitap', 1),
    ('hobi-kitap-muzik', 'Müzik', 'muzik', 2),
    ('hobi-kitap-muzik', 'Hobi', 'hobi', 3),

    ('ofis-kirtasiye', 'Ofis', 'ofis', 1),
    ('ofis-kirtasiye', 'Kırtasiye', 'kirtasiye', 2),

    ('spor-outdoor', 'Spor', 'spor-urunleri', 1),
    ('spor-outdoor', 'Outdoor', 'outdoor', 2),

    ('diger-araclar', 'Karavan', 'karavan', 1),
    ('diger-araclar', 'Tekne', 'tekne', 2),
    ('diger-araclar', 'Tarım Aracı', 'tarim-araci', 3),
    ('diger-araclar', 'Römork', 'romork', 4),
    ('diger-araclar', 'Araç Parça', 'arac-parca', 5),

    ('antika', 'Antika', 'antika-urunler', 1),
    ('antika', 'Koleksiyon', 'koleksiyon', 2),

    ('pet-shop', 'Pet Ürünleri', 'pet-urunleri', 1),
    ('pet-shop', 'Kedi Ürünleri', 'kedi-urunleri', 2),
    ('pet-shop', 'Köpek Ürünleri', 'kopek-urunleri', 3),
    ('pet-shop', 'Kuş Ürünleri', 'kus-urunleri', 4),

    ('hizmet', 'Temizlik', 'temizlik', 1),
    ('hizmet', 'Tamir & Bakım', 'tamir-bakim', 2),
    ('hizmet', 'Fotoğraf & Video', 'fotograf-video', 3),
    ('hizmet', 'Nakliye', 'nakliye', 4),

    ('is-ilanlari', 'Tam Zamanlı', 'tam-zamanli', 1),
    ('is-ilanlari', 'Yarı Zamanlı', 'yari-zamanli', 2),
    ('is-ilanlari', 'Freelance', 'freelance', 3),

    ('diger', 'Diğer Ürünler', 'diger-urunler', 1)
)
INSERT INTO categories (parent_id, name, slug, sort_order)
SELECT parent.id, data.name, data.slug, data.sort_order
FROM data
JOIN categories parent ON parent.slug = data.parent_slug
ON CONFLICT (slug) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
