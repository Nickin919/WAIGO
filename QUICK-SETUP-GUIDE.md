# Quick Setup Guide - Fix Your Setup Issues

## ✅ Issue Resolved!

I've fixed the seed file and created your `.env` file. Here's what to do next:

---

## 🔧 Step-by-Step Setup

### Step 1: Update Database URL ⚠️ IMPORTANT

Open `backend\.env` and update the DATABASE_URL with your PostgreSQL credentials:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/wago_hub
```

**Example:**
```env
# If your PostgreSQL username is 'postgres' and password is 'mypassword'
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/wago_hub
```

**Don't have PostgreSQL?** Two options:

#### Option A: Install PostgreSQL Locally
1. Download: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember your password!
4. Default username is usually: `postgres`
5. Default port: `5432`

#### Option B: Use Railway's Free PostgreSQL (Easier!)
1. Go to: https://railway.app
2. Sign up (free)
3. Create new project → Add PostgreSQL
4. Copy the DATABASE_URL from Railway
5. Paste into your `.env` file

---

### Step 2: Create Database

If using local PostgreSQL:

```powershell
# Open PostgreSQL command prompt or use pgAdmin
createdb wago_hub

# OR using psql:
psql -U postgres
CREATE DATABASE wago_hub;
\q
```

If using Railway: Database is auto-created! ✅

---

### Step 3: Run Migrations

```powershell
cd "c:\VossLaptop\Cursor Files\WAIGO App\backend"
npx prisma migrate dev --name init
```

This creates all the database tables.

---

### Step 4: Run Seed

```powershell
npx prisma db seed
```

This creates demo users and sample data.

---

### Step 5: Start the Application

```powershell
# From backend folder
npm run dev

# OR from project root (in another terminal)
cd "c:\VossLaptop\Cursor Files\WAIGO App"
npm run dev
```

---

## ✅ What I Fixed

### 1. Updated Seed File
Changed old role names to new 6-tier system:
- ❌ `role: 'USER'` (doesn't exist anymore)
- ✅ `role: 'BASIC'` (correct new role)

Added more demo users:
- ✅ BASIC user
- ✅ TURNKEY user with team
- ✅ RSM user
- ✅ Sample categories and parts

### 2. Created .env File
- ✅ Created `backend\.env` with all required variables
- ⚠️ You need to update DATABASE_URL with your credentials

---

## 🎯 Demo Credentials (After Seeding)

```
Admin:       admin@wago.com / admin123
BASIC User:  user@demo.com / user123
TurnKey:     turnkey@demo.com / turnkey123
Distributor: distributor@demo.com / dist123
RSM:         rsm@wago.com / rsm123
```

---

## 🆘 Common Issues & Solutions

### "Environment variable not found: DATABASE_URL"
✅ **Solution:** Edit `backend\.env` and set your DATABASE_URL

### "database 'wago_hub' does not exist"
✅ **Solution:** Create the database first:
```powershell
createdb wago_hub
# OR use pgAdmin to create database
```

### "password authentication failed"
✅ **Solution:** Check your PostgreSQL password in DATABASE_URL

### "Can't connect to PostgreSQL"
✅ **Solution:** 
- Make sure PostgreSQL is running
- Check the port (default: 5432)
- Verify username and password

### "prisma command not found"
✅ **Solution:**
```powershell
cd backend
npm install
```

---

## 📋 Complete Setup Checklist

- [ ] PostgreSQL installed (or Railway account)
- [ ] Database created (`wago_hub`)
- [ ] Updated `backend\.env` with DATABASE_URL
- [ ] Ran `npx prisma generate`
- [ ] Ran `npx prisma migrate dev --name init`
- [ ] Ran `npx prisma db seed`
- [ ] Started backend: `npm run dev`
- [ ] Started frontend: `cd ../frontend && npm run dev`
- [ ] Accessed http://localhost:5173
- [ ] Logged in with demo credentials

---

## 🚀 Quick Test

After setup, test that everything works:

```powershell
# 1. Test database connection
npx prisma studio
# Opens visual database editor at http://localhost:5555

# 2. Check users were created
# In Prisma Studio, click "users" table
# You should see 5 users

# 3. Start the app
npm run dev
# Backend should start on http://localhost:3001
```

---

## 💡 Using Railway (Easiest Option)

If you don't want to install PostgreSQL locally:

1. **Sign up at Railway.app** (free tier available)
2. **Create new project** → Add PostgreSQL
3. **Copy DATABASE_URL** from Railway dashboard
4. **Paste into** `backend\.env`
5. **Run migrations** and seed
6. ✅ **Done!** No local PostgreSQL needed

Railway provides:
- Free PostgreSQL database
- Automatic backups
- Web interface
- Easy deployment later

---

## 🎯 Next Steps After Successful Setup

1. ✅ Access frontend: http://localhost:5173
2. ✅ Login with: `admin@wago.com` / `admin123`
3. ✅ Try Product Import: Sidebar → "Import Products"
4. ✅ Try Catalog Creator: Sidebar → "My Catalogs"
5. ✅ Explore all features!

---

## 📞 Still Having Issues?

### Check Backend Console
Look for errors in the terminal where backend is running.

### Check Frontend Console
Press F12 in browser → Console tab → Look for errors

### Verify Environment
```powershell
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Check PostgreSQL version (if local)
psql --version
```

---

## ✨ Summary

**What was wrong:**
- Seed file used old role name `'USER'` instead of `'BASIC'`
- Missing `.env` file with DATABASE_URL

**What I fixed:**
- ✅ Updated seed file to use correct roles
- ✅ Created `.env` file with template
- ✅ Added TurnKey, RSM users to seed

**What you need to do:**
1. Update DATABASE_URL in `backend\.env`
2. Run `npx prisma migrate dev --name init`
3. Run `npx prisma db seed`
4. Start the app!

---

**After you update the DATABASE_URL and run the migrations, the seed should work perfectly!** 🚀

Let me know if you hit any other issues!
