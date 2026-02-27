import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { getUploadDir, ensureUploadDirs } from './lib/uploadPath';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('   Please set it in backend/.env or your deployment environment');
    process.exit(1);
  }
}

// Import routes
import publicRoutes from './routes/public.routes';
import authRoutes from './routes/auth.routes';
import catalogRoutes from './routes/catalog.routes';
import categoryRoutes from './routes/category.routes';
import partRoutes from './routes/part.routes';
import videoRoutes from './routes/video.routes';
import commentRoutes from './routes/comment.routes';
import quoteRoutes from './routes/quote.routes';
import projectRoutes from './routes/project.routes';
import crossReferenceRoutes from './routes/crossReference.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import userManagementRoutes from './routes/userManagement.routes';
import costTableRoutes from './routes/costTable.routes';
import customerRoutes from './routes/customer.routes';
import literatureRoutes from './routes/literature.routes';
import videoLibraryRoutes from './routes/videoLibrary.routes';
import literatureKitRoutes from './routes/literatureKit.routes';
import productImportRoutes from './routes/productImport.routes';
import catalogCreatorRoutes from './routes/catalogCreator.routes';
import assignmentsRoutes from './routes/assignments.routes';
import accountsRoutes from './routes/accounts.routes';
import priceContractRoutes from './routes/priceContract.routes';
import myRoutes from './routes/my.routes';
import salesRoutes from './routes/sales.routes';
import webhooksRoutes from './routes/webhooks.routes';
import bannerRoutes from './routes/banner.routes';
import appSettingsRoutes from './routes/appSettings.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// Middleware
// ============================================================================

// Security
app.use(helmet());

// Trust Railway reverse proxy (required for rate limiting)
app.set('trust proxy', 1);

// CORS
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files (uploads) – same path as multer; uses Railway volume when RAILWAY_VOLUME_MOUNT_PATH is set
ensureUploadDirs();
app.use('/uploads', express.static(getUploadDir()));

// Rate limiting: general API (1000 req/15 min per IP), stricter for auth (100 req/15 min)
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '1000', 10),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? '100', 10),
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ============================================================================
// Routes
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required - FREE user access)
app.use('/api/public', publicRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/cross-references', crossReferenceRoutes);
app.use('/api/admin/products', productImportRoutes); // Must be before /api/admin (more specific)
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// New user hierarchy routes
app.use('/api/user-management', userManagementRoutes);
app.use('/api/cost-tables', costTableRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/literature', literatureRoutes);
app.use('/api/literature-kits', literatureKitRoutes);
app.use('/api/video-library', videoLibraryRoutes);
app.use('/api/catalog-creator', catalogCreatorRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/price-contracts', priceContractRoutes);
app.use('/api/my', myRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/app-settings', appSettingsRoutes);

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFound);
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================

const MASTER_CATALOG_NAME = 'Master Catalog';

async function ensureMasterCatalog(): Promise<void> {
  const existingMaster = await prisma.catalog.findFirst({
    where: { isMaster: true },
    select: { id: true },
  });
  if (existingMaster) return;

  const byName = await prisma.catalog.findFirst({
    where: { name: MASTER_CATALOG_NAME },
    select: { id: true, isMaster: true },
  });
  if (byName) {
    if (!byName.isMaster) {
      await prisma.catalog.update({
        where: { id: byName.id },
        data: { isMaster: true, isActive: true },
      });
      console.log(`✅ Marked "${MASTER_CATALOG_NAME}" as MASTER`);
    }
    return;
  }

  await prisma.catalog.create({
    data: {
      name: MASTER_CATALOG_NAME,
      description: 'Default catalog for product imports. All other catalogs are built from this.',
      isMaster: true,
      isActive: true,
      isPublic: false,
    },
  });
  console.log(`✅ Created default "${MASTER_CATALOG_NAME}" (MASTER)`);
}

const startServer = async () => {
  try {
    // Verify database connection
    console.log('🔌 Connecting to database...');
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

    try {
      await ensureMasterCatalog();
    } catch (err) {
      console.error('⚠️ Master Catalog setup failed (server will still start):', err);
    }

    const server = app.listen(PORT, () => {
      const host = process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
      console.log(`🚀 Server running on http://${host}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Email: ${process.env.SMTP_HOST ? 'Configured' : 'Not configured (optional)'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n⏹️  Shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('👋 Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

export default app;
