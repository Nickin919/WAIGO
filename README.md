# WAGO Project Hub

A comprehensive, mobile-first platform for industrial/mechanical users to browse WAGO product catalogs, watch video tutorials, create projects with multi-manufacturer BOMs, and generate pricing proposals.

## Features

- 🔐 **Authentication**: Email/password with role-based access (user, admin, distributor)
- 📱 **2D Gesture Navigation**: Horizontal category carousel + vertical scroll for parts
- 🎥 **Video Academy**: Level-based video tutorials with engagement tracking
- 💼 **Project Creator**: Multi-manufacturer BOM management with WAGO cross-referencing
- 💰 **Pricing Proposals**: CSV-based pricing with category/series discounts
- 📊 **Admin Dashboard**: Catalog management, video approval, cross-reference maintenance

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router (navigation)
- Zustand (state management)
- Swiper.js (gesture navigation)
- PapaParse (CSV handling)
- jsPDF (PDF generation)

### Backend
- Node.js + Express with TypeScript
- PostgreSQL (database)
- Prisma ORM
- JWT authentication
- Multer (file uploads)
- Nodemailer (email notifications)

### Deployment
- Railway (target platform)

## Project Structure

```
├── frontend/           # React frontend application
├── backend/            # Express backend API
├── shared/             # Shared TypeScript types
├── prisma/             # Database schema and migrations
└── docs/               # Additional documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Set up environment variables:
```bash
# Backend (.env)
cp backend/.env.example backend/.env
# Edit with your database URL, JWT secret, etc.

# Frontend (.env)
cp frontend/.env.example frontend/.env
# Edit with your API URL
```

4. Set up the database:
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

5. Run the development servers:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Deployment to Railway

See [docs/railway-deployment.md](docs/railway-deployment.md) for detailed deployment instructions.

## License

Proprietary - All rights reserved
