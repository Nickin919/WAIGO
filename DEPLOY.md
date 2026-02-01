# Deploy to GitHub & Railway

## Part 1: Push to GitHub

### 1. Create a new repository on GitHub
- Go to https://github.com/new
- Name it (e.g. `wago-project-hub`)
- Leave it **empty** (no README, .gitignore, or license)

### 2. Push from your project folder

```powershell
cd "c:\VossLaptop\Cursor Files\WAIGO App"

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: WAGO Project Hub"

# Add GitHub remote (replace YOUR_USERNAME and YOUR_REPO with your values)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push (use main or master depending on your default branch)
git branch -M main
git push -u origin main
```

---

## Part 2: Deploy to Railway

### 1. Create Railway account
- Go to https://railway.app and sign up (GitHub login works)

### 2. Create new project
- Click **New Project**
- Select **Deploy from GitHub repo**
- Choose your `wago-project-hub` repository

### 3. Add PostgreSQL
- In the project, click **+ New**
- Select **Database** → **PostgreSQL**
- Railway provisions it and provides `DATABASE_URL`

### 4. Configure the backend service
- Click your service (the one from GitHub)
- Go to **Settings**
  - **Root Directory:** `backend`
  - **Build Command:** `npm install && npm run build` (or leave default)
  - **Start Command:** `npm start` (or leave default)

### 5. Add environment variables
In **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Click **Add Reference** → PostgreSQL → `DATABASE_URL` |
| `JWT_SECRET` | Generate a long random string (e.g. `openssl rand -base64 32`) |
| `NODE_ENV` | `production` |
| `PORT` | Railway sets this automatically (optional) |
| `CORS_ORIGINS` | Your frontend URL (e.g. `https://your-app.railway.app`) |

### 6. Generate domain & deploy
- Go to **Settings** → **Networking** → **Generate Domain**
- Railway will build and deploy. First build may take 2–3 minutes.

### 7. Seed the database (first time only)
After the first successful deploy:
- Install Railway CLI: `npm i -g @railway/cli`
- Login: `railway login`
- Link: `railway link` (select your project)
- Run: `railway run --service backend npx prisma db seed`

Or use Railway Dashboard → your backend service → **Settings** → **Deploy** → add a one-off run.

---

## Part 3: Deploy Frontend (optional)

To deploy the frontend on Railway or Vercel:

1. Create a new service/project
2. Set **Root Directory** to `frontend`
3. Add variable: `VITE_API_URL` = your backend URL (e.g. `https://your-backend.railway.app`)
4. Build: `npm install && npm run build`
5. Output: `dist` folder; use a static host (Vercel, Netlify, or Railway static)

---

## Troubleshooting

**Build fails:** Check build logs. Ensure `DATABASE_URL` is set and PostgreSQL is running.

**Can't connect to DB:** Verify `DATABASE_URL` is referenced from the PostgreSQL service.

**CORS errors:** Set `CORS_ORIGINS` to your frontend URL (no trailing slash).
