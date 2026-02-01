# Create Admin User - Easiest Method

## ✅ 2-Step Process (Takes 2 minutes)

Since Prisma Studio isn't showing the role dropdown properly, here's the easiest way:

---

## Step 1: Register via the App

1. **Go to:** http://localhost:5174
2. **Click:** "Sign up" or "Register"
3. **Fill in:**
   - Email: `nick@nwvoss.com`
   - Password: `password123`
   - First Name: `Nick`
   - Last Name: `VossAdmin`
4. **Click:** "Create Account"

This will create you as a BASIC user initially.

---

## Step 2: Upgrade to ADMIN via Prisma Studio

1. **Prisma Studio is already open at:** http://localhost:5555

2. **Click** "User" in the left sidebar

3. **Find your user** (nick@nwvoss.com) in the list

4. **Click** on the row to edit it

5. **Find the "role" field** and **manually type:** `ADMIN`
   (Even if it's not a dropdown, you can type the value directly)

6. **Click** "Save 1 change"

---

## Step 3: Login as Admin! 🎉

1. **Go back to:** http://localhost:5174
2. **Login** with:
   - Email: `nick@nwvoss.com`
   - Password: `password123`

3. **You now have ADMIN access!** You'll see:
   - "Import Products" in the sidebar (Admin section)
   - All user management features
   - Full system access

---

## Alternative: Use pgAdmin (If you have it)

If you have pgAdmin installed:

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Navigate to: Servers → PostgreSQL → Databases → wago_hub
4. Right-click → Query Tool
5. Paste this SQL:

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

6. Click Execute (F5)

---

## ✅ Quick Summary

**Easiest Path:**
1. Register at http://localhost:5174 (creates BASIC user)
2. Edit role to "ADMIN" in Prisma Studio at http://localhost:5555
3. Login again - you're now ADMIN!

**Your Credentials:**
- Email: nick@nwvoss.com
- Password: password123
- Role: ADMIN (after step 2)

---

**Go ahead and register now!** Then just edit the role field in Prisma Studio to say "ADMIN". 🚀
