# WAGO Project Hub - Quick Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Prerequisites Check
Ensure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ PostgreSQL 14+ installed and running
- ✅ Git installed

### Step 2: Database Setup
```bash
# Create a PostgreSQL database
createdb wago_hub

# Or using psql:
psql -U postgres
CREATE DATABASE wago_hub;
\q
```

### Step 3: Install Dependencies
```powershell
# From project root
npm install
```

### Step 4: Configure Environment

**Backend (.env)**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your settings:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/wago_hub"
JWT_SECRET="your-super-secret-jwt-key-change-this"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**Frontend (.env)**
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
```

### Step 5: Initialize Database
```bash
cd ../backend
npx prisma migrate dev
npx prisma db seed
```

### Step 6: Start Development Servers

**Option A: Use root script (recommended)**
```bash
# From project root
npm run dev
```

**Option B: Manual start (2 terminals)**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Step 7: Access the Application

🌐 **Frontend**: http://localhost:5173
🔌 **Backend API**: http://localhost:3001

### Step 8: Login with Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wago.com | admin123 |
| User | user@demo.com | user123 |
| Distributor | distributor@demo.com | dist123 |

---

## 📁 Project Structure

```
WAIGO App/
├── backend/              # Express + TypeScript API
│   ├── src/
│   │   ├── controllers/  # Business logic
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Auth, uploads, errors
│   │   ├── lib/          # Utilities
│   │   └── server.ts     # Entry point
│   └── prisma/
│       └── schema.prisma # Database schema
├── frontend/             # React + TypeScript UI
│   ├── src/
│   │   ├── components/   # Reusable UI
│   │   ├── pages/        # Page components
│   │   ├── stores/       # State management
│   │   └── lib/          # API client
│   └── public/
├── docs/                 # Documentation
└── prisma/              # Migrations
```

---

## 🎯 Key Features Implemented

### ✅ Authentication & Authorization
- Email/password login with bcrypt
- JWT-based auth
- Role-based access (USER, ADMIN, DISTRIBUTOR)

### ✅ Catalog Management
- Hierarchical categories (unlimited depth)
- Parts with metadata
- File attachments (datasheets, CAD)

### ✅ 2D Gesture Navigation
- Horizontal carousel for top categories (Swiper.js)
- Vertical scroll for subcategories/parts
- Mobile-first responsive design

### ✅ Video Academy
- Level-based progression (1, 2, 3)
- View tracking (gray out after 2 views)
- Comments with threading
- Admin approval workflow

### ✅ Project Creator
- Multi-manufacturer BOM support
- CSV import/export
- Cross-reference to WAGO parts
- Revision history

### ✅ Pricing Proposals
- CSV-based pricing input
- Category/series discounts
- Distributor margin calculations
- Quote generation

### ✅ Admin Dashboard
- User management
- Video approval queue
- Catalog statistics
- Bulk operations

---

## 🛠️ Development Commands

### Backend
```bash
cd backend

# Development with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Database operations
npx prisma studio          # Visual DB editor
npx prisma migrate dev     # Create migration
npx prisma db seed         # Seed database
npx prisma generate        # Generate Prisma Client

# Type checking
npm run type-check
```

### Frontend
```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## 🚢 Deployment to Railway

See [docs/railway-deployment.md](./docs/railway-deployment.md) for complete Railway deployment guide.

**Quick Deploy:**
1. Push to GitHub
2. Create Railway project from GitHub repo
3. Add PostgreSQL database
4. Set environment variables
5. Deploy!

---

## 🐛 Troubleshooting

### Port Already in Use
```powershell
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Database Connection Error
1. Ensure PostgreSQL is running:
   ```bash
   # Windows (if installed as service)
   net start postgresql-x64-14
   ```
2. Verify DATABASE_URL in `.env`
3. Check database exists: `psql -U postgres -l`

### Prisma Client Not Found
```bash
cd backend
npx prisma generate
```

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear Prisma cache
rm -rf node_modules/.prisma
npx prisma generate
```

---

## 📚 Additional Documentation

- [Getting Started Guide](./docs/getting-started.md) - Detailed setup instructions
- [Railway Deployment](./docs/railway-deployment.md) - Production deployment guide
- [API Documentation](./docs/api.md) - API endpoints reference (coming soon)

---

## 🎨 Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Router (navigation)
- Swiper.js (gesture navigation)
- Axios (HTTP client)

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (database)
- Prisma ORM
- JWT (authentication)
- Bcrypt (password hashing)
- Multer (file uploads)
- Nodemailer (emails)

**Deployment:**
- Railway (hosting)
- GitHub (version control)

---

## 📝 Next Steps

1. ✅ Set up local development environment
2. ✅ Explore the demo data
3. 🔲 Customize catalog structure
4. 🔲 Add your product data
5. 🔲 Configure SMTP for emails
6. 🔲 Deploy to Railway
7. 🔲 Add custom domain
8. 🔲 Set up SSL certificate

---

## 💡 Tips

- Use Prisma Studio for visual database management: `npx prisma studio`
- Check backend logs for API debugging
- Use React DevTools for frontend debugging
- Test on mobile devices early (mobile-first design)
- Keep demo credentials for testing

---

## 🤝 Support

For issues and questions:
1. Check [Getting Started Guide](./docs/getting-started.md)
2. Review [Troubleshooting](#-troubleshooting) section
3. Check project issues on GitHub
4. Create a new issue with details

---

**Happy coding! 🚀**
