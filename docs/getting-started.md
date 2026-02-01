# Getting Started with WAGO Project Hub

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd "WAIGO App"
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. **Set up environment variables**

Backend (.env):
```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and other settings
```

Frontend (.env):
```bash
cd frontend
cp .env.example .env
# Edit .env with your API URL
```

4. **Set up the database**
```bash
cd backend
# Run migrations
npx prisma migrate dev
# Seed with demo data
npx prisma db seed
```

5. **Start development servers**

In separate terminal windows:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Demo Credentials

After seeding, you can log in with:
- **Admin**: admin@wago.com / admin123
- **User**: user@demo.com / user123
- **Distributor**: distributor@demo.com / dist123

## Project Structure

```
WAIGO App/
├── backend/               # Express backend
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, error handling
│   │   ├── lib/          # Utilities (prisma, jwt, email)
│   │   └── server.ts     # Entry point
│   └── prisma/
│       ├── schema.prisma # Database schema
│       └── seed.ts       # Seed data
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── layouts/      # Layout components
│   │   ├── pages/        # Page components
│   │   ├── stores/       # Zustand stores
│   │   ├── lib/          # API client
│   │   └── App.tsx       # Root component
│   └── index.html
├── docs/                 # Documentation
└── README.md
```

## Key Features

### 1. Authentication
- Email/password login
- JWT-based authentication
- Role-based access control (User, Admin, Distributor)

### 2. 2D Gesture Navigation
- Horizontal swipe for top-level categories
- Vertical scroll for subcategories and parts
- Mobile-first design with Swiper.js

### 3. Video Academy
- Level-based tutorials (1, 2, 3)
- View tracking and progression
- Comments with threading
- Video upload and admin approval

### 4. Project Creator
- Multi-manufacturer BOM management
- CSV import/export
- WAGO cross-reference suggestions
- Revision tracking

### 5. Pricing Proposals
- CSV-based pricing input
- Category/series discounts
- Distributor margin calculations
- PDF generation

## Development Workflow

### Database Changes

1. Modify `prisma/schema.prisma`
2. Create migration:
```bash
npx prisma migrate dev --name description_of_change
```
3. Update seed if needed

### Adding New API Endpoints

1. Create controller in `backend/src/controllers/`
2. Create route in `backend/src/routes/`
3. Register route in `backend/src/server.ts`
4. Add API function in `frontend/src/lib/api.ts`

### Adding New Pages

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Update navigation if needed

## Testing

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

## Deployment

See [Railway Deployment Guide](./railway-deployment.md) for production deployment.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3001 (backend)
npx kill-port 3001

# Kill process on port 5173 (frontend)
npx kill-port 5173
```

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Check DATABASE_URL in .env
3. Verify database exists

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Support

For issues and questions:
- Check documentation in `docs/`
- Review existing issues
- Create a new issue with detailed information
