# Create Admin User - Instructions

## Quick Method: Use Prisma Studio

Since there's a Prisma client sync issue, the easiest way to create your admin user is through Prisma Studio (visual database editor).

### Steps:

1. **Open Prisma Studio:**
```powershell
cd "c:\VossLaptop\Cursor Files\WAIGO App\backend"
npx prisma studio
```

This will open at: http://localhost:5555

2. **Navigate to Users Table:**
   - Click on "User" in the left sidebar

3. **Click "Add record" button**

4. **Fill in the fields:**
   - **email:** `nick@nwvoss.com`
   - **passwordHash:** `$2b$10$sjxMPsERLbwzc6LHTTAKwO1Ki/4IYULVYgjAV20YItA3j3piNcI9m`
     (This is the hash for: password123)
   - **firstName:** `Nick`
   - **lastName:** `VossAdmin`
   - **role:** Select `ADMIN` from dropdown
   - **isActive:** Check the box (true)
   - Leave other fields empty/null

5. **Click "Save 1 change"**

6. **Done!** Now you can login at http://localhost:5174 with:
   - Email: nick@nwvoss.com
   - Password: password123

---

## Alternative: Direct SQL

If you prefer SQL:

```sql
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'nick@nwvoss.com',
  '$2b$10$sjxMPsERLbwzc6LHTTAKwO1Ki/4IYULVYgjAV20YItA3j3piNcI9m',
  'Nick',
  'VossAdmin',
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

Run this in pgAdmin or psql.

---

## Your Admin Credentials

**Email:** nick@nwvoss.com  
**Password:** password123  
**Role:** ADMIN  
**Name:** Nick VossAdmin  

---

## After Creating Admin User

You'll have full access to:
- ✅ Product Import Tool (CSV)
- ✅ User Management
- ✅ Video Approval
- ✅ All Catalogs (from all users)
- ✅ System Administration
- ✅ Everything!

---

## Note About Prisma Client Issue

The Prisma client generation is having a permission issue because processes are running. This is a Windows file locking issue and doesn't affect the actual functionality once everything is running.

The workaround using Prisma Studio works perfectly!
