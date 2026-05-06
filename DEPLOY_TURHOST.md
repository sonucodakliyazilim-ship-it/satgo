# Turhost Yayına Alma Rehberi

Bu proje statik/PHP site değildir. Yayına almak için iki Node.js uygulaması ve PostgreSQL gerekir:

1. Backend API: proje kökü, başlangıç dosyası `src/server.js`
2. Frontend Next.js: `frontend` klasörü, önce `npm run build`, sonra `npm run start`
3. Veritabanı: PostgreSQL

Standart cPanel web hosting paketinde yalnızca PHP/MySQL varsa bu proje doğrudan çalışmaz. Turhost tarafında Node.js uygulaması ve PostgreSQL desteği olan paket, Cloud/VPS sunucu veya Turhost destek ekibinin Node.js + PostgreSQL çalıştırabildiğini onayladığı bir servis gerekir.

## Önerilen Domain Yapısı

- Site: `https://satgo.tr`
- API: `https://api.satgo.tr`

Bu ayrım CORS, upload dosyaları ve Socket.io için daha temizdir.

## 1. Turhost Tarafında Hazırlık

1. Alan adını Turhost DNS'e bağla.
2. SSL'i hem ana domain hem `api` subdomain için aktif et.
3. `api.satgo.tr` subdomain'i oluştur.
4. PostgreSQL veritabanı oluştur:
   - DB adı: örnek `satgo_db`
   - DB kullanıcısı: örnek `satgo_user`
   - Güçlü şifre
5. Node.js desteğinde Node 18 veya üzeri seç.

## 2. Yüklenecek Dosyalar

Sunucuya proje kökündeki dosyaları yükle. Bunları yükleme:

- `node_modules`
- `frontend/node_modules`
- `frontend/.next`
- `.pgdata`
- yerel log dosyaları

`uploads` klasörünü silme; ilan ve banner görselleri burada tutulur. Sunucuda yazılabilir olmalı.

## 3. Backend `.env`

`.env.production.example` dosyasını sunucuda `.env` olarak kopyala ve gerçek değerleri gir:

```env
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=satgo_db
DB_USER=satgo_user
DB_PASSWORD=GERCEK_DB_SIFRESI
DATABASE_URL=
DB_SSL=false
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=10000

JWT_SECRET=COK_UZUN_RASTGELE_DEGER
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=BASKA_COK_UZUN_RASTGELE_DEGER
JWT_REFRESH_EXPIRES_IN=7d

ADMIN_NAME=Satgo Admin
ADMIN_EMAIL=admin@satgo.tr
ADMIN_PASSWORD=GUCLU_ADMIN_SIFRESI

BCRYPT_ROUNDS=12
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
MAX_FILES_PER_LISTING=10

FRONTEND_URL=https://satgo.tr,https://www.satgo.tr

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300

BANK_NAME=
IBAN=
IBAN_OWNER=
```

Ödeme bilgilerini yayına aldıktan sonra admin panelindeki **Ödeme Bilgileri** alanından güncelle.

## 4. Frontend `.env.production`

`frontend/.env.production.example` dosyasını `frontend/.env.production` olarak kopyala:

```env
NEXT_PUBLIC_API_URL=https://api.satgo.tr/api
NEXT_PUBLIC_SOCKET_URL=https://api.satgo.tr
```

Bu dosya build almadan önce hazır olmalı; Next.js bu değerleri build içine yazar.

## 5. Kurulum Komutları

Backend klasöründe:

```bash
npm install --omit=dev
npm run db:migrate
npm run db:seed
npm start
```

Frontend klasöründe:

```bash
cd frontend
npm install
npm run build
npm prune --omit=dev
npm run start
```

## 6. cPanel Node.js App Ayarı

Backend uygulaması:

- Application root: proje kökü
- Startup file: `src/server.js`
- Application mode: Production
- Environment variables: backend `.env` değerleri

Frontend uygulaması:

- Application root: `frontend`
- Startup command: `npm run start`
- Application mode: Production
- Environment variables: `NEXT_PUBLIC_API_URL` ve `NEXT_PUBLIC_SOCKET_URL`

Panel tek Node.js app'e izin veriyorsa frontend'i ve backend'i aynı pakette çalıştırmak zorlaşır. Bu durumda Cloud/VPS veya iki ayrı Node.js app desteği gerekir.

## 7. Yayın Sonrası Kontrol

1. `https://api.satgo.tr/api/health` açılmalı ve `db: connected` dönmeli.
2. `https://satgo.tr` ana sayfa açılmalı.
3. `https://satgo.tr/giris` üzerinden admin hesabıyla giriş yapılmalı.
4. `/admin` panelinde ödeme bilgileri kaydedilmeli.
5. Test ilanı ve test banner görseli yüklenmeli.
6. `uploads` dosyalarının `https://api.satgo.tr/uploads/...` üzerinden açıldığı doğrulanmalı.

## 8. En Sık Hata Noktaları

- Sadece PHP/MySQL hosting almak: Bu proje çalışmaz.
- PostgreSQL yerine MySQL açmak: Şema PostgreSQL içindir.
- Frontend build'den sonra `NEXT_PUBLIC_API_URL` değiştirmek: Yeniden build gerekir.
- `FRONTEND_URL` alanına gerçek domain'i yazmamak: CORS hatası verir.
- `uploads` klasörünün yazma izni olmaması: Görsel yükleme hata verir.
- `npm run db:migrate` çalıştırmamak: Tablolar eksik kalır.
- `npm run db:seed` çalıştırmamak: Admin hesabı oluşmaz.
