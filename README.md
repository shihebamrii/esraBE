# Médiathèque Backend API

A production-ready Node.js backend for a Tunisian media platform featuring video/audio content and a tourism photo gallery.

## 📋 Overview

This backend powers two main sections:

1. **Contenus à impact** - Videos, podcasts, reels, documentaries
2. **Tounesna** - Tourism photos with watermarked previews and paid high-res downloads

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (LTS)
- MongoDB 6+ (local or Atlas)
- npm or yarn

### Installation

```bash
# Clone and navigate
cd Backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Seed the database
npm run seed

# Start development server
npm run dev
```

### Using Docker

```bash
# Start all services (app + MongoDB + Mongo Express)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

Access points:

- API: http://localhost:5000
- Mongo Express: http://localhost:8081 (admin/admin123)

## 📁 Project Structure

```
Backend/
├── src/
│   ├── config/          # Database, app configuration
│   ├── controllers/     # Route handlers
│   ├── middlewares/     # Auth, validation, error handling
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routes
│   ├── services/        # Business logic (storage, payment)
│   ├── utils/           # Helpers, validators
│   └── jobs/            # Background processing (TODO)
├── seed/                # Sample data scripts
├── docs/                # Additional documentation
├── server.js            # Entry point
└── app.js               # Express setup
```

## 🔐 Authentication

JWT-based authentication with access + refresh tokens.

```
POST /api/auth/register   - Register new user
POST /api/auth/login      - Get tokens
POST /api/auth/refresh-token - Refresh access token
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me         - Current user (protected)
POST /api/auth/logout     - Logout (protected)
```

### Test Accounts (after seeding)

| Role     | Email                    | Password   |
| -------- | ------------------------ | ---------- |
| Admin    | admin@mediatheque.tn     | Admin123!  |
| Uploader | uploader1@mediatheque.tn | Upload123! |
| User     | user1@example.com        | User123!   |

## 📹 API Endpoints

### Public Content

```
GET  /api/contents          - List with filters
GET  /api/contents/:id      - Get content details
GET  /api/media/:fileId     - Stream media (supports Range)
```

### Public Photos (Tounesna)

```
GET  /api/photos            - List with filters
GET  /api/photos/:id        - Get photo details
GET  /api/photos/:id/preview - Free watermarked preview
GET  /api/photos/packs      - List photo packs
GET  /api/photos/packs/:id  - Pack details
```

### Admin (protected)

```
POST   /api/admin/content/upload  - Upload content
PUT    /api/admin/content/:id     - Update content
DELETE /api/admin/content/:id     - Delete content
POST   /api/admin/photos/upload   - Upload photo
POST   /api/admin/packs           - Create pack
```

### Cart & Checkout

```
GET    /api/cart            - View cart
POST   /api/cart            - Add item
DELETE /api/cart/:itemId    - Remove item
POST   /api/checkout        - Create order
GET    /api/checkout/orders - My orders
```

### Search

```
GET /api/search?q=...       - Search all content
GET /api/search/suggest?q=  - Autocomplete
```

## 💾 GridFS & MongoDB Compass

Media files are stored in MongoDB using GridFS. In Compass, you'll see:

- `fs.files` - File metadata
- `fs.chunks` - Binary file chunks

### Connecting with Compass

```
mongodb://localhost:27017/mediatheque
```

After uploading content, refresh and expand the collections to see files.

## 💳 Payment Integration

The API supports multiple payment providers via adapter pattern:

```javascript
// Current provider set in .env
PAYMENT_PROVIDER = mock; // mock | stripe | paytech
```

### Testing Payment Flow

1. Add items to cart
2. Call `POST /api/checkout`
3. Visit the returned `paymentUrl` (mock auto-completes)
4. Order status updates to "paid"
5. Download links become available

### Switching to Stripe

```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

See `docs/STORAGE_MIGRATION.md` for S3/R2 transition.

## 🔧 Environment Variables

| Variable           | Description          | Default                               |
| ------------------ | -------------------- | ------------------------------------- |
| PORT               | Server port          | 5000                                  |
| MONGO_URI          | MongoDB connection   | mongodb://localhost:27017/mediatheque |
| JWT_SECRET         | JWT signing secret   | (required)                            |
| JWT_REFRESH_SECRET | Refresh token secret | (required)                            |
| TOKEN_EXPIRY       | Access token TTL     | 15m                                   |
| PAYMENT_PROVIDER   | mock/stripe/paytech  | mock                                  |
| GRIDFS_BUCKET_NAME | GridFS bucket        | mediaFiles                            |

## 📊 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration
```

## 🐛 Development

```bash
# Start with nodemon
npm run dev

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

---

## 🇫🇷 Résumé en Français

Backend Node.js/Express pour une médiathèque tunisienne avec:

- **Contenus à impact**: vidéos, podcasts, documentaires
- **Tounesna**: galerie photos touristiques avec aperçus watermarkés

### Démarrage Rapide

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

### Avec Docker

```bash
docker-compose up -d
```

Accès: http://localhost:5000

---

## 📝 License

ISC © CnBees Team
