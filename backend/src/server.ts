import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

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
import teamRoutes from './routes/team.routes';
import costTableRoutes from './routes/costTable.routes';
import productImportRoutes from './routes/productImport.routes';
import catalogCreatorRoutes from './routes/catalogCreator.routes';

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

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// New user hierarchy routes
app.use('/api/user-management', userManagementRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/cost-tables', costTableRoutes);
app.use('/api/admin/products', productImportRoutes);
app.use('/api/catalog-creator', catalogCreatorRoutes);

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFound);
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================

const startServer = async () => {
  try {
    // Verify database connection
    console.log('🔌 Connecting to database...');
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

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
