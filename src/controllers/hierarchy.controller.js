const multer = require('multer');
const { query } = require('../config/database');

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const ensureGroupSettingsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hierarchy_group_settings (
      group_key VARCHAR(80) PRIMARY KEY,
      group_label VARCHAR(160),
      group_hint VARCHAR(255),
      level_labels TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE hierarchy_group_settings
      ADD COLUMN IF NOT EXISTS group_label VARCHAR(160),
      ADD COLUMN IF NOT EXISTS group_hint VARCHAR(255)
  `);
};

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

const VEHICLE_BRANDS = {
  Abarth: ['595', '695', 'Punto'],
  'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Tonale', 'MiTo', '156', '159'],
  Anadol: ['A1', 'A2', 'A4', 'STC-16'],
  'Aston Martin': ['DB11', 'DB12', 'Vantage', 'DBX'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT'],
  Bentley: ['Continental', 'Flying Spur', 'Bentayga'],
  BMW: ['116i', '118i', '120i', '216d', '218i', '320i', '320d', '418i', '420i', '520i', '520d', '530i', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'i3', 'i4', 'i5', 'iX'],
  BYD: ['Atto 3', 'Dolphin', 'Seal', 'Tang', 'Han'],
  Cadillac: ['Escalade', 'CTS', 'SRX', 'XT5'],
  Chery: ['Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Omoda 5', 'Arrizo 8'],
  Chevrolet: ['Aveo', 'Cruze', 'Captiva', 'Spark', 'Lacetti', 'Epica', 'Kalos'],
  Citroen: ['C-Elysee', 'C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'Berlingo', 'Jumpy'],
  Cupra: ['Formentor', 'Leon', 'Ateca', 'Born'],
  Dacia: ['Sandero', 'Sandero Stepway', 'Logan', 'Duster', 'Jogger', 'Lodgy', 'Dokker'],
  Daewoo: ['Lanos', 'Nubira', 'Matiz', 'Espero'],
  Daihatsu: ['Terios', 'Sirion', 'Cuore', 'Materia'],
  Dodge: ['Caliber', 'Journey', 'Nitro', 'Charger'],
  DS: ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  Ferrari: ['Portofino', 'Roma', 'F8', '296 GTB'],
  Fiat: ['Albea', 'Egea', 'Linea', 'Doblo', 'Fiorino', 'Punto', '500', '500X', 'Tipo', 'Panda', 'Ducato'],
  Ford: ['Fiesta', 'Focus', 'Mondeo', 'Kuga', 'Puma', 'EcoSport', 'Courier', 'Connect', 'Custom', 'Transit', 'Ranger'],
  Geely: ['Coolray', 'Geometry C', 'Emgrand'],
  Honda: ['Civic', 'City', 'Jazz', 'Accord', 'CR-V', 'HR-V', 'ZR-V', 'e:Ny1'],
  Hyundai: ['i10', 'i20', 'i30', 'Accent', 'Elantra', 'Tucson', 'Bayon', 'Kona', 'Santa Fe', 'Staria'],
  Infiniti: ['Q30', 'Q50', 'QX30', 'FX'],
  Isuzu: ['D-Max', 'NPR', 'NQR', 'Turkuaz'],
  Iveco: ['Daily', 'Eurocargo', 'Stralis'],
  Jaguar: ['XE', 'XF', 'XJ', 'F-Pace', 'E-Pace', 'I-Pace'],
  Jeep: ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Avenger'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'XCeed', 'Cerato', 'Sportage', 'Stonic', 'Sorento', 'Niro', 'EV6'],
  Lada: ['Niva', 'Samara', 'Vega', 'Kalina'],
  Lamborghini: ['Huracan', 'Aventador', 'Urus', 'Revuelto'],
  Lancia: ['Delta', 'Ypsilon', 'Musa'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['IS', 'ES', 'NX', 'RX', 'UX'],
  Maserati: ['Ghibli', 'Quattroporte', 'Levante', 'Grecale'],
  Mazda: ['2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'MX-5'],
  'Mercedes-Benz': ['A180', 'A200', 'B180', 'C180', 'C200', 'E200', 'E220', 'CLA 200', 'GLA 200', 'GLB 200', 'GLC 300', 'GLE 300', 'Vito', 'Sprinter'],
  MG: ['ZS', 'HS', 'MG4', 'Marvel R', 'EHS'],
  Mini: ['Cooper', 'Cooper S', 'Clubman', 'Countryman', 'Paceman'],
  Mitsubishi: ['Colt', 'Lancer', 'ASX', 'Eclipse Cross', 'Outlander', 'L200', 'Pajero'],
  Nissan: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Navara', 'Note', 'Townstar'],
  Opel: ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Combo', 'Vivaro'],
  Peugeot: ['206', '207', '208', '301', '307', '308', '408', '508', '2008', '3008', '5008', 'Partner', 'Rifter'],
  Porsche: ['911', 'Boxster', 'Cayman', 'Panamera', 'Macan', 'Cayenne', 'Taycan'],
  Renault: ['Clio', 'Megane', 'Taliant', 'Fluence', 'Symbol', 'Captur', 'Kadjar', 'Austral', 'Kangoo', 'Trafic', 'Master'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Toledo', 'Alhambra'],
  Skoda: ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Rapid'],
  Smart: ['Fortwo', 'Forfour', '#1'],
  SsangYong: ['Korando', 'Tivoli', 'Rexton', 'Musso'],
  Subaru: ['Impreza', 'Legacy', 'XV', 'Forester', 'Outback', 'BRZ'],
  Suzuki: ['Swift', 'Vitara', 'S-Cross', 'Jimny', 'Baleno', 'SX4'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
  Togg: ['T10X', 'T10F'],
  Toyota: ['Corolla', 'Yaris', 'C-HR', 'Auris', 'RAV4', 'Camry', 'Hilux', 'Proace', 'Land Cruiser'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Jetta', 'Tiguan', 'T-Roc', 'Taigo', 'Arteon', 'Caddy', 'Transporter', 'Caravelle', 'Crafter'],
  Volvo: ['S40', 'S60', 'S90', 'V40', 'V60', 'XC40', 'XC60', 'XC90', 'EX30'],
};

const MOTOR_BRANDS = {
  Aprilia: ['SR GT 200', 'RS 125', 'RS 660', 'Tuono 660', 'Tuareg 660'],
  Bajaj: ['Pulsar NS 125', 'Pulsar NS 200', 'Dominar 250', 'Dominar 400'],
  Benelli: ['TNT 125', 'TNT 249S', 'TRK 251', 'TRK 502', 'Leoncino 500'],
  'BMW Motorrad': ['G 310 R', 'G 310 GS', 'F 750 GS', 'F 850 GS', 'R 1250 GS', 'R 1300 GS', 'S 1000 RR'],
  'CF Moto': ['250 NK', '250 SR', '450 SR', '650 MT', '800 MT', 'XO Papio'],
  Ducati: ['Monster', 'Scrambler', 'Multistrada', 'Panigale', 'Diavel', 'Streetfighter'],
  'Harley-Davidson': ['Sportster', 'Iron 883', 'Street Bob', 'Fat Boy', 'Nightster', 'Pan America'],
  Honda: ['PCX 125', 'Dio', 'Forza 250', 'CBR 125R', 'CB 250R', 'CB 500F', 'NC750X', 'X-ADV', 'Africa Twin'],
  Husqvarna: ['Svartpilen 250', 'Svartpilen 401', 'Vitpilen 401', 'Norden 901'],
  Kawasaki: ['Ninja 250', 'Ninja 400', 'Ninja 650', 'Z400', 'Z650', 'Z900', 'Versys 650', 'Vulcan S'],
  KTM: ['Duke 125', 'Duke 250', 'Duke 390', 'Adventure 250', 'Adventure 390', 'RC 390', '790 Adventure'],
  Kuba: ['Bluebird', 'CR1', 'TK03', 'Superlight', 'Chia'],
  Kymco: ['Agility 125', 'People S', 'Downtown 250', 'Xciting 400', 'AK 550'],
  Mondial: ['Revival 50', 'SFC 100', 'Drift L', 'RX3i Evo', 'ZNU 125'],
  Piaggio: ['Beverly 300', 'Medley 150', 'Liberty 125', 'MP3 300'],
  RKS: ['Newlight 125 Pro', 'Blazer 50', 'Grace 202', 'Freccia 150', 'RN 180'],
  'Royal Enfield': ['Classic 350', 'Meteor 350', 'Hunter 350', 'Himalayan', 'Interceptor 650'],
  Suzuki: ['Burgman 200', 'Burgman 400', 'V-Strom 250', 'V-Strom 650', 'GSX-R 125', 'GSX-S 750', 'Hayabusa'],
  SYM: ['Jet 14', 'Joyride 200', 'Maxsym 400', 'Cruisym 250'],
  Triumph: ['Trident 660', 'Street Triple', 'Tiger 900', 'Bonneville T100', 'Speed Twin'],
  TVS: ['Jupiter', 'Raider 125', 'Apache RTR 200', 'Apache RR 310'],
  Vespa: ['Primavera', 'Sprint', 'GTS 300', 'VXL 150'],
  Yamaha: ['NMAX 125', 'XMAX 250', 'Tracer 700', 'MT-07', 'MT-09', 'R25', 'R7', 'Tenere 700'],
};

const buildCatalogPaths = (catalog, series) =>
  Object.entries(catalog).flatMap(([brand, models]) =>
    models.flatMap((model) => series.map(([line, pack]) => [brand, model, line, pack])),
  );

const EXTENDED_DEFAULT_PATHS = {
  vehicle: [
    ['Fiat', 'Albea', 'Dynamic', '1.6 LPG'],
    ...buildCatalogPaths(VEHICLE_BRANDS, [
      ['Standart', 'Baz Paket'],
      ['Premium', 'Full Paket'],
    ]),
  ],
  motor: buildCatalogPaths(MOTOR_BRANDS, [
    ['Standart', 'ABS'],
    ['Touring', 'Çantalı'],
  ]),
  telefon: [
    ['iPhone iOS Telefon', 'Apple', 'iPhone 17 Pro Max', '1 TB'],
    ['iPhone iOS Telefon', 'Apple', 'iPhone 16 Pro Max', '256 GB'],
    ['iPhone iOS Telefon', 'Apple', 'iPhone 15 Pro', '128 GB'],
    ['Android Telefon', 'Samsung', 'Galaxy S24 Ultra', '512 GB'],
    ['Android Telefon', 'Xiaomi', 'Redmi Note 13 Pro', '256 GB'],
    ['Android Telefon', 'Oppo', 'Reno Serisi', '128 GB'],
    ['Telefon Aksesuarları', 'Kulaklık', 'Bluetooth', 'Kablosuz'],
    ['Telefon Yedek Parçaları', 'Ekran', 'iPhone', 'OLED'],
  ],
  'kisisel-bakim-kozmetik': [
    ['Kozmetik', 'Parfüm', 'Kadın', 'EDP'],
    ['Kozmetik', 'Makyaj', 'Fondöten', 'Orta Ton'],
    ['Kişisel Bakım', 'Tıraş Makinesi', 'Kablosuz', 'Islak Kuru'],
    ['Kişisel Bakım', 'Saç Kurutma', 'Profesyonel', 'İyonik'],
  ],
  'anne-bebek-oyuncak': [
    ['Bebek', 'Bebek Arabası', 'Travel Sistem', 'Katlanabilir'],
    ['Bebek', 'Oto Koltuğu', '0-36 kg', 'Isofix'],
    ['Oyuncak', 'Eğitici Oyuncak', 'Ahşap', '3+ Yaş'],
    ['Çocuk Giyim', 'Ayakkabı', 'Spor', 'Ortopedik'],
  ],
  'hobi-kitap-muzik': [
    ['Kitap', 'Roman', 'Türk Edebiyatı', 'Ciltli'],
    ['Kitap', 'Ders Kitabı', 'Lise', 'Sayısal'],
    ['Müzik', 'Gitar', 'Elektro Gitar', 'Amfi Seti'],
    ['Hobi', 'Koleksiyon', 'Plak', 'LP'],
  ],
  'ofis-kirtasiye': [
    ['Ofis', 'Ofis Masası', 'Çalışma Masası', 'Ahşap'],
    ['Ofis', 'Ofis Koltuğu', 'Ergonomik', 'Fileli'],
    ['Kırtasiye', 'Kalem', 'Dolma Kalem', 'Set'],
    ['Kırtasiye', 'Yazıcı Sarf', 'Toner', 'Muadil'],
  ],
  'spor-outdoor': [
    ['Spor', 'Fitness', 'Koşu Bandı', 'Ev Tipi'],
    ['Spor', 'Bisiklet', 'Dağ Bisikleti', '29 Jant'],
    ['Outdoor', 'Kamp', 'Çadır', '4 Kişilik'],
    ['Outdoor', 'Balıkçılık', 'Olta Takımı', 'Spin'],
  ],
  'diger-araclar': [
    ['Karavan', 'Çekme Karavan', '750 kg Altı', 'Ruhsatsız'],
    ['Tekne', 'Fiber Tekne', 'Motorlu', 'Balıkçı'],
    ['Tarım Aracı', 'Traktör', 'Bahçe Tipi', 'Dizel'],
    ['Römork', 'Araç Römorku', 'Tek Dingil', 'Kapaklı'],
    ['Araç Parça', 'Lastik & Jant', 'Jant', '17 İnç'],
  ],
  antika: [
    ['Antika', 'Mobilya', 'Konsol', 'Ahşap'],
    ['Antika', 'Obje', 'Pirinç', 'El İşçiliği'],
    ['Koleksiyon', 'Plak', '45lik', 'Türkçe'],
    ['Koleksiyon', 'Para', 'Osmanlı', 'Gümüş'],
  ],
  'pet-shop': [
    ['Pet Ürünleri', 'Mama', 'Kedi Maması', 'Yetişkin'],
    ['Pet Ürünleri', 'Taşıma Çantası', 'Kedi', 'Kabin Boy'],
    ['Kedi Ürünleri', 'Kum Kabı', 'Kapalı', 'Filtreli'],
    ['Köpek Ürünleri', 'Tasma', 'Göğüs Tasması', 'Ayarlanabilir'],
    ['Kuş Ürünleri', 'Kafes', 'Muhabbet Kuşu', 'Büyük Boy'],
  ],
};

const seededDefaultGroups = new Set();

const ROOT_ALIASES = {
  vehicle: new Set(['arac', 'araç', 'otomobil', 'vasita', 'vehicle']),
  motor: new Set(['motor', 'motosiklet', 'motorcycle']),
  telefon: new Set(['telefon', 'cep telefonu', 'cep-telefonu']),
  elektronik: new Set(['elektronik', 'bilgisayar']),
  emlak: new Set(['emlak', 'konut']),
  'ev-esyasi': new Set(['ev-esyasi', 'ev eşyası', 'ev esyasi']),
};

const makeSlug = (value) =>
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
      label VARCHAR(160) NOT NULL,
      slug VARCHAR(180) NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS hierarchy_options_unique_root_path
    ON hierarchy_options (group_key, slug)
    WHERE parent_id IS NULL AND is_active = TRUE
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS hierarchy_options_unique_child_path
    ON hierarchy_options (group_key, parent_id, slug)
    WHERE parent_id IS NOT NULL AND is_active = TRUE
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_hierarchy_options_group_parent
    ON hierarchy_options (group_key, parent_id, sort_order)
  `);
};

const getGroupSettings = async (req, res, next) => {
  try {
    await ensureGroupSettingsTable();
    const requestedGroup = req.query.group || req.query.group_key;
    if (!requestedGroup) {
      const { rows } = await query(
        `SELECT group_key, group_label, group_hint, level_labels
         FROM hierarchy_group_settings
         ORDER BY group_key ASC`,
      );
      return res.json({ success: true, data: rows });
    }

    const groupKey = normalizeGroup(requestedGroup);
    const { rows } = await query(
      'SELECT group_key, group_label, group_hint, level_labels FROM hierarchy_group_settings WHERE group_key = $1',
      [groupKey],
    );
    res.json({
      success: true,
      data: rows[0] || { group_key: groupKey, group_label: null, group_hint: null, level_labels: [] },
    });
  } catch (err) {
    next(err);
  }
};

const updateGroupSettings = async (req, res, next) => {
  try {
    await ensureGroupSettingsTable();
    const groupKey = normalizeGroup(req.body.group_key || req.body.group);
    const labels = Array.isArray(req.body.level_labels) ? req.body.level_labels.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const groupLabel = req.body.group_label === undefined ? null : String(req.body.group_label || '').trim() || null;
    const groupHint = req.body.group_hint === undefined ? null : String(req.body.group_hint || '').trim() || null;
    if (!groupKey) return res.status(422).json({ success: false, message: 'group_key gerekli.' });

    const existing = await query('SELECT group_key FROM hierarchy_group_settings WHERE group_key = $1', [groupKey]);
    const { rows } = await query(
      existing.rows.length
        ? `UPDATE hierarchy_group_settings SET
             group_label = COALESCE($2, group_label),
             group_hint = COALESCE($3, group_hint),
             level_labels = $4,
             updated_at = NOW()
           WHERE group_key = $1
           RETURNING group_key, group_label, group_hint, level_labels`
        : `INSERT INTO hierarchy_group_settings (group_key, group_label, group_hint, level_labels)
           VALUES ($1,$2,$3,$4)
           RETURNING group_key, group_label, group_hint, level_labels`,
      [groupKey, groupLabel, groupHint, labels],
    );
    res.json({ success: true, message: 'Seviye etiketleri güncellendi.', data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const upsertNode = async ({ groupKey, parentId = null, label, level = 0, sortOrder = 0 }) => {
  const cleanLabel = String(label || '').trim();
  if (!cleanLabel) return null;

  const slug = makeSlug(cleanLabel);
  const existing = parentId
    ? await query(
        `SELECT id
         FROM hierarchy_options
         WHERE group_key = $1
           AND parent_id = $2
           AND slug = $3
         LIMIT 1`,
        [groupKey, parentId, slug],
      )
    : await query(
        `SELECT id
         FROM hierarchy_options
         WHERE group_key = $1
           AND parent_id IS NULL
           AND slug = $2
         LIMIT 1`,
        [groupKey, slug],
      );

  const { rows } = await query(
    existing.rows.length
      ? `UPDATE hierarchy_options SET
           label = $1,
           level = $2,
           sort_order = $3,
           is_active = TRUE,
           updated_at = NOW()
         WHERE id = $4
         RETURNING *`
      : `INSERT INTO hierarchy_options (group_key, parent_id, label, slug, level, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)
         RETURNING *`,
    existing.rows.length
      ? [cleanLabel, level, sortOrder, existing.rows[0].id]
      : [groupKey, parentId, cleanLabel, slug, level, sortOrder],
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

const importDefaultPaths = async (groupKey, paths) => {
  const cache = new Map();
  let imported = 0;

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    let parentId = null;
    const cleanPath = paths[pathIndex].map((item) => String(item || '').trim()).filter(Boolean);

    for (let level = 0; level < cleanPath.length; level += 1) {
      const label = cleanPath[level];
      const cacheKey = `${parentId || 'root'}:${makeSlug(label)}`;
      if (cache.has(cacheKey)) {
        parentId = cache.get(cacheKey);
        continue;
      }

      const node = await upsertNode({
        groupKey,
        parentId,
        label,
        level,
        sortOrder: pathIndex * 10 + level,
      });
      if (!node) continue;

      cache.set(cacheKey, node.id);
      parentId = node.id;
      imported += 1;
    }
  }

  return imported;
};

const ensureDefaults = async (groupKey) => {
  if (seededDefaultGroups.has(groupKey)) return;

  const defaults = [...(DEFAULT_PATHS[groupKey] || []), ...(EXTENDED_DEFAULT_PATHS[groupKey] || [])];
  if (!defaults.length) {
    seededDefaultGroups.add(groupKey);
    return;
  }

  await importDefaultPaths(groupKey, defaults);

  seededDefaultGroups.add(groupKey);
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
    try {
      await ensureDefaults(groupKey);
    } catch (seedErr) {
      console.error('[hierarchy] ensureDefaults failed for', groupKey, seedErr?.message || seedErr);
    }

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
  getGroupSettings,
  updateGroupSettings,
  createNode,
  updateNode,
  deleteNode,
  importCsv,
};
