# ilanGO Backend API

Full-featured classified ads platform backend built with **Node.js + Express + PostgreSQL + Socket.io**.

---

## Tech Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Runtime      | Node.js 18+              |
| Framework    | Express 4                |
| Database     | PostgreSQL 15+           |
| Auth         | JWT (access + refresh)   |
| Real-time    | Socket.io 4              |
| Uploads      | Multer (local disk)      |
| Validation   | express-validator        |
| Security     | Helmet, CORS, Rate-limit |

---

## Project Structure

```
ilanGO-backend/
├── sql/
│   └── schema.sql              # Full PostgreSQL schema (run first)
├── src/
│   ├── server.js               # Entry point + Express + Socket.io setup
│   ├── config/
│   │   ├── database.js         # pg Pool + helpers (query, withTransaction)
│   │   └── migrate.js          # npm run db:migrate
│   ├── middleware/
│   │   ├── auth.middleware.js  # JWT verify, requireAdmin, requireOwner
│   │   └── validate.middleware.js
│   ├── controllers/
│   │   ├── auth.controller.js       # register, login, refresh, logout
│   │   ├── listing.controller.js    # CRUD + vehicle/realestate details
│   │   ├── category.controller.js
│   │   ├── favorite.controller.js
│   │   ├── message.controller.js    # conversations + messages
│   │   ├── promotion.controller.js  # packages + mock payment
│   │   ├── admin.controller.js      # dashboard + moderation
│   │   ├── user.controller.js       # profile management
│   │   └── upload.controller.js     # image upload/delete
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── listing.routes.js
│   │   ├── category.routes.js
│   │   ├── favorite.routes.js
│   │   ├── message.routes.js
│   │   ├── promotion.routes.js
│   │   ├── admin.routes.js
│   │   ├── user.routes.js
│   │   └── upload.routes.js
│   └── utils/
│       └── socketHandler.js    # Socket.io rooms + typing indicators
├── uploads/                    # Auto-created, stores listing images
├── .env.example
└── package.json
```

---

## Quick Start

### 1 — Prerequisites
- Node.js 18+
- PostgreSQL 15+

### 2 — Clone & Install

```bash
git clone <repo-url> ilango-backend
cd ilango-backend
npm install
```

### 3 — Environment

```bash
cp .env.example .env
# Edit .env with your DB credentials and JWT secrets
```

### 4 — Create Database

```bash
psql -U postgres -c "CREATE DATABASE ilango_db;"
```

### 5 — Run Migration (creates all tables + seeds categories & packages)

```bash
npm run db:migrate
```

### 6 — Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:5000`

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Auth Header
```
Authorization: Bearer <accessToken>
```

---

### 🔐 Auth  `/api/auth`

| Method | Endpoint             | Auth | Description              |
|--------|----------------------|------|--------------------------|
| POST   | `/register`          | ❌   | Create account           |
| POST   | `/login`             | ❌   | Get tokens               |
| POST   | `/refresh`           | ❌   | Rotate refresh token     |
| POST   | `/logout`            | ❌   | Invalidate refresh token |
| POST   | `/forgot-password`   | ❌   | Send reset email         |
| POST   | `/reset-password`    | ❌   | Set new password         |

**Register body:**
```json
{
  "name": "Ahmet Kaya",
  "email": "ahmet@mail.com",
  "password": "Secure123",
  "phone": "05321234567",
  "city": "İstanbul"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Ahmet Kaya", "role": "user" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### 🏠 Listings  `/api/listings`

| Method | Endpoint              | Auth     | Description              |
|--------|-----------------------|----------|--------------------------|
| GET    | `/`                   | Optional | List with filters        |
| GET    | `/:id`                | Optional | Single listing detail    |
| GET    | `/user/:userId`       | ❌       | Listings by user         |
| POST   | `/`                   | ✅       | Create listing           |
| PATCH  | `/:id`                | ✅ Owner | Update listing           |
| DELETE | `/:id`                | ✅ Owner | Delete listing           |

**GET /api/listings — Query params:**
```
?search=honda civic
&category=1
&city=İstanbul
&district=Kadıköy
&minPrice=10000
&maxPrice=500000
&sortBy=newest|cheapest|priciest|popular
&featured=true
&page=1
```

**POST /api/listings — Create vehicle listing:**
```json
{
  "category_id": 1,
  "sub_category_id": 11,
  "title": "2021 Honda Civic 1.5 Turbo",
  "description": "Temiz araç, hasarsız...",
  "price": 485000,
  "price_negotiable": false,
  "condition": "like_new",
  "city": "İstanbul",
  "district": "Kadıköy",
  "vehicle_details": {
    "brand": "Honda",
    "model": "Civic",
    "year": 2021,
    "mileage": 42000,
    "fuel_type": "gasoline",
    "transmission": "automatic",
    "body_type": "sedan",
    "color": "Beyaz",
    "has_damage_record": false,
    "trade_in": false
  }
}
```

**POST /api/listings — Create real estate listing:**
```json
{
  "category_id": 3,
  "title": "Satılık 3+1 Daire",
  "price": 3500000,
  "city": "İstanbul",
  "district": "Sarıyer",
  "real_estate_details": {
    "listing_type": "sale",
    "size_m2": 120,
    "room_count": "3+1",
    "building_age": 5,
    "floor": 4,
    "total_floors": 8,
    "heating": "central",
    "is_furnished": false,
    "has_balcony": true,
    "has_parking": true,
    "has_elevator": true,
    "monthly_dues": 850
  }
}
```

---

### 📁 Categories  `/api/categories`

| Method | Endpoint    | Auth        | Description              |
|--------|-------------|-------------|--------------------------|
| GET    | `/`         | ❌          | All categories with subs |
| GET    | `/:slug`    | ❌          | Single category          |
| POST   | `/`         | ✅ Admin    | Create category          |
| PATCH  | `/:id`      | ✅ Admin    | Update category          |

---

### ❤️ Favorites  `/api/favorites`

| Method | Endpoint             | Auth | Description          |
|--------|----------------------|------|----------------------|
| GET    | `/`                  | ✅   | My favorites         |
| GET    | `/check/:listingId`  | ✅   | Is favorited?        |
| POST   | `/:listingId`        | ✅   | Add to favorites     |
| DELETE | `/:listingId`        | ✅   | Remove from favorites|

---

### 💬 Messaging  `/api/messages`

| Method | Endpoint                         | Auth | Description                  |
|--------|----------------------------------|------|------------------------------|
| GET    | `/conversations`                 | ✅   | All conversations (inbox)    |
| GET    | `/conversations/:conversationId` | ✅   | Messages in a conversation   |
| POST   | `/`                              | ✅   | Send message (starts conv.)  |
| DELETE | `/:messageId`                    | ✅   | Soft-delete a message        |

**POST /api/messages:**
```json
{
  "listing_id": "uuid-of-listing",
  "content": "Merhaba, araç hala satılık mı?"
}
```

---

### 💎 Promotions  `/api/promotions`

| Method | Endpoint     | Auth | Description            |
|--------|--------------|------|------------------------|
| GET    | `/packages`  | ❌   | Available packages     |
| GET    | `/my`        | ✅   | My purchase history    |
| POST   | `/purchase`  | ✅   | Buy a package          |
| POST   | `/webhook`   | ❌   | Payment gateway hook   |

**POST /api/promotions/purchase:**
```json
{
  "listing_id": "uuid-of-your-listing",
  "package_id": 1,
  "payment_method": "mock"
}
```
> Set `payment_method: "mock"` during development — payment auto-completes instantly.
> Replace with `"iyzico"` / `"paytr"` / `"stripe"` when integrating real payments.

---

### 🖼️ Uploads  `/api/upload`

| Method | Endpoint                             | Auth | Description          |
|--------|--------------------------------------|------|----------------------|
| POST   | `/listing-images/:listingId`         | ✅   | Upload images        |
| DELETE | `/listing-images/:imageId`           | ✅   | Delete image         |
| PATCH  | `/listing-images/:imageId/primary`   | ✅   | Set as primary photo |

Upload via `multipart/form-data`, field name: `images` (up to 10 files, 5MB each).

---

### 👤 Users  `/api/users`

| Method | Endpoint          | Auth | Description          |
|--------|-------------------|------|----------------------|
| GET    | `/:id`            | ❌   | Public user profile  |
| GET    | `/me/profile`     | ✅   | My full profile      |
| PATCH  | `/me/profile`     | ✅   | Update profile       |
| PATCH  | `/me/password`    | ✅   | Change password      |
| POST   | `/reports`        | ✅   | Report a listing     |

---

### 🛡️ Admin  `/api/admin`  *(admin role required)*

| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | `/dashboard`               | Stats overview           |
| GET    | `/users`                   | List all users           |
| PATCH  | `/users/:id/status`        | Ban / activate user      |
| GET    | `/listings`                | All listings             |
| PATCH  | `/listings/:id/status`     | Approve / reject / delete|
| GET    | `/reports`                 | Pending reports          |
| PATCH  | `/reports/:id`             | Resolve a report         |
| GET    | `/promotions`              | All promotion purchases  |
| POST   | `/packages`                | Create promo package     |
| PATCH  | `/packages/:id`            | Update promo package     |

---

### ⚡ Real-time (Socket.io)

**Connect:**
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000', {
  auth: { token: '<accessToken>' }
});
```

**Events:**
```js
// Join a conversation room
socket.emit('join_conversation', conversationId);

// Listen for new messages
socket.on('new_message', (message) => { ... });

// Typing indicators
socket.emit('typing', { conversationId });
socket.on('user_typing', ({ userId, conversationId }) => { ... });

// Notification: new message in inbox
socket.on('new_conversation_message', ({ conversationId, preview }) => { ... });
```

---

## Database Schema Overview

```
users
 ├── listings (user_id)
 │    ├── listing_images (listing_id)
 │    ├── vehicle_details (listing_id, 1-to-1)
 │    ├── motorcycle_details (listing_id, 1-to-1)
 │    ├── real_estate_details (listing_id, 1-to-1)
 │    ├── favorites (listing_id)
 │    ├── reports (listing_id)
 │    ├── listing_promotions (listing_id)
 │    └── conversations (listing_id)
 │         └── messages (conversation_id)
 └── refresh_tokens (user_id)

categories (self-referencing parent_id for sub-categories)
promotion_packages → listing_promotions
```

### Key DB Features
- **UUID primary keys** for all main tables
- **Triggers** for `updated_at`, favorite counts, and auto-syncing promotion flags
- **Full-text search** index on listings (Turkish language)
- **Connection pooling** (max 20 connections)
- **Transactions** for multi-table writes

---

## Payment Integration (Production)

The promotion system is modular. To add iyzico/PayTR/Stripe:

1. Open `src/controllers/promotion.controller.js`
2. In `purchasePromotion()`, replace the `mock` block with your payment SDK call
3. Return a checkout URL to the frontend
4. The `/api/promotions/webhook` endpoint receives the success callback
5. Verify the webhook signature and call the same DB update logic

---

## Security Checklist

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ JWT with short-lived access tokens (15min) + rotating refresh tokens
- ✅ Helmet.js sets secure HTTP headers
- ✅ CORS restricted to frontend URL
- ✅ Rate limiting (100 req/15min global, 10 req/15min on auth)
- ✅ express-validator on all inputs
- ✅ SQL injection prevented via parameterized queries
- ✅ Ownership checks before any mutation
- ✅ Admin role enforced server-side
