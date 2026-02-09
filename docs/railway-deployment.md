# Railway Deployment Guide

This guide walks you through deploying the WAGO Project Hub to Railway.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. GitHub account (for connecting your repository)
3. PostgreSQL database (Railway provides this)

## Deployment Steps

### 1. Prepare the Repository

Ensure your code is pushed to a GitHub repository.

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Create Railway Project

1. Log in to Railway (https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 3. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create and provision a PostgreSQL instance
4. Copy the `DATABASE_URL` from the PostgreSQL service variables

### 4. Configure Backend Service

1. Select your backend service in Railway
2. Go to "Variables" tab
3. Add the following environment variables:

```
NODE_ENV=production
DATABASE_URL=<from PostgreSQL service>
JWT_SECRET=<generate-a-secure-random-string>
JWT_EXPIRES_IN=7d
SMTP_HOST=<your-smtp-host>
SMTP_PORT=587
SMTP_USER=<your-smtp-username>
SMTP_PASS=<your-smtp-password>
FROM_EMAIL=noreply@wagohub.com
FROM_NAME=WAGO Project Hub
FRONTEND_URL=<your-frontend-url-after-deployment>
CORS_ORIGINS=<your-frontend-url-after-deployment>
PORT=3001
```

4. Go to "Settings" tab
5. Set "Root Directory" to `backend`
6. Set "Build Command" to `npm install && npx prisma generate && npm run build`
7. Set "Start Command" to `npm start`

### 5. Run Database Migrations

After backend deploys:

1. Go to backend service
2. Click on "Deploy Logs"
3. Open a new deployment
4. Railway will run migrations automatically through the build process

Alternatively, use Railway CLI:

```bash
railway run npx prisma migrate deploy
railway run npx prisma db seed
```

### 6. Configure Frontend Service

1. Create a new service in Railway for the frontend
2. Set "Root Directory" to `frontend`
3. Add environment variables:

```
VITE_API_URL=<your-backend-url-from-railway>
```

4. Build Command: `npm install && npm run build`
5. Start Command: `npx serve -s dist -l 5173`

### 7. Connect Services

Railway will automatically provide URLs for both services. Update:

1. Backend `FRONTEND_URL` and `CORS_ORIGINS` with the frontend URL
2. Frontend `VITE_API_URL` with the backend URL

### 8. Custom Domains (Optional)

1. Go to service settings
2. Click "Generate Domain" or add a custom domain
3. Follow DNS configuration instructions

### 9. Persistent storage for uploads (recommended)

Profile photos, company logos, and other uploads are stored on the backend. By default they live on the container filesystem and **are lost on every deploy**. To keep them across deploys, attach a Railway Volume to the **backend (WAIGO)** service:

1. In the Railway project, open the **Command Palette** (⌘K or Ctrl+K) or right‑click the canvas.
2. Choose **Add Volume** (or **Create volume**).
3. When prompted, **connect the volume to the WAIGO service** (your backend).
4. Set the **mount path** to `/data`.
   - The app will use `RAILWAY_VOLUME_MOUNT_PATH` (set by Railway) and store uploads under `/data/uploads` (avatars, logos, literature, etc.).
5. Redeploy the WAIGO service so it starts with the volume mounted.

No extra environment variables are required. When `RAILWAY_VOLUME_MOUNT_PATH` is set, the backend uses it automatically. To use a custom path instead, set `UPLOAD_DIR` (e.g. `UPLOAD_DIR=/data/uploads`) and mount the volume to the parent path.

**Note:** Volumes are mounted at **runtime**, not at build time. Any files written during build are not on the volume. Backups: use Railway’s volume backup options from the volume settings.

## Database Management

### Running Migrations

```bash
railway run npx prisma migrate deploy
```

### Seeding Database

```bash
railway run npx prisma db seed
```

### Accessing Prisma Studio

```bash
railway run npx prisma studio
```

## Monitoring

1. Check deployment logs in Railway dashboard
2. Monitor error rates and performance
3. Set up health check endpoints

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Verify environment variables are set correctly
- Check Railway build logs for specific errors

### Database Connection Issues

- Verify `DATABASE_URL` is correctly formatted
- Ensure PostgreSQL service is running
- Check firewall/network settings

### CORS Errors

- Verify `CORS_ORIGINS` includes your frontend URL
- Check that both services are deployed and accessible

## Cost Optimization

Railway offers:
- $5/month free credit (Hobby plan)
- Usage-based pricing after free credit
- Optimize by:
  - Using appropriate instance sizes
  - Enabling sleep mode for development environments
  - Monitoring resource usage

## Backup Strategy

1. Enable automated PostgreSQL backups in Railway
2. Export data regularly using Prisma:
   ```bash
   railway run npx prisma db pull
   ```
3. Keep migrations in version control

## Support

- Railway Documentation: https://docs.railway.app
- Railway Community: https://discord.gg/railway
- Project Issues: Create an issue in your GitHub repository
