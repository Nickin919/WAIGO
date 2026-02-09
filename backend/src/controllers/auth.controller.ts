import { Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { sendWelcomeEmail } from '../lib/email';
import { AuthRequest } from '../middleware/auth';

/**
 * Register a new user
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (full schema: passwordHash, firstName, lastName, catalogId, etc.)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: role || 'BASIC'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        catalogId: true,
        avatarUrl: true,
        address: true,
        phone: true,
        createdAt: true
      }
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email ?? '',
      role: user.role,
      catalogId: user.catalogId
    });

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(user.email ?? '', user.firstName ?? undefined).catch(console.error);

    res.status(201).json({
      user,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Login user
 */
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    // Find user (full schema: passwordHash, isActive)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        catalogId: true,
        isActive: true,
        avatarUrl: true,
        address: true,
        phone: true,
        defaultTerms: true
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email ?? '',
      role: user.role,
      catalogId: user.catalogId
    });

    // Remove password hash from response
    const { passwordHash: _ph, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        role: true,
        catalogId: true,
        distributorMarginPercent: true,
        isActive: true,
        avatarUrl: true,
        address: true,
        phone: true,
        defaultTerms: true,
        createdAt: true,
        updatedAt: true,
        catalog: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Update user profile (firstName, lastName, email, address, phone, defaultTerms).
 * Changing email requires currentPassword for verification.
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { firstName, lastName, email, address, phone, defaultTerms, currentPassword } = req.body;

    const data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      address?: string;
      phone?: string;
      defaultTerms?: string;
    } = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (defaultTerms !== undefined) data.defaultTerms = defaultTerms === '' ? null : defaultTerms;

    if (email !== undefined && email !== null && email !== '') {
      const trimmed = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      const existing = await prisma.user.findFirst({
        where: { email: trimmed, id: { not: req.user.id } }
      });
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      if (!currentPassword || typeof currentPassword !== 'string') {
        res.status(400).json({ error: 'Current password is required to change email' });
        return;
      }
      const userWithPass = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { passwordHash: true }
      });
      if (!userWithPass?.passwordHash) {
        res.status(400).json({ error: 'Cannot change email for this account' });
        return;
      }
      const isValid = await bcrypt.compare(currentPassword, userWithPass.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
      data.email = trimmed;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        role: true,
        catalogId: true,
        avatarUrl: true,
        address: true,
        phone: true,
        defaultTerms: true,
        updatedAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    });

    if (!user || !user.passwordHash) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

/**
 * Get current user's recent activity (last 10–20 actions from quotes, projects, customers)
 */
export const getMyActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const userId = req.user.id;
    const limitPerType = 8;

    const [quotes, projects, customers] = await Promise.all([
      prisma.quote.findMany({
        where: { userId },
        select: { id: true, quoteNumber: true, customerName: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: limitPerType
      }),
      prisma.project.findMany({
        where: { userId },
        select: { id: true, name: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: limitPerType
      }),
      prisma.customer.findMany({
        where: { createdById: userId },
        select: { id: true, name: true, company: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limitPerType
      })
    ]);

    type ActivityItem = {
      type: 'quote' | 'project' | 'customer';
      id: string;
      title: string;
      date: string;
    };

    const items: ActivityItem[] = [
      ...quotes.map((q) => ({
        type: 'quote' as const,
        id: q.id,
        title: `Quote ${q.quoteNumber}${q.customerName ? ` – ${q.customerName}` : ''}`,
        date: q.updatedAt.toISOString()
      })),
      ...projects.map((p) => ({
        type: 'project' as const,
        id: p.id,
        title: p.name,
        date: p.updatedAt.toISOString()
      })),
      ...customers.map((c) => ({
        type: 'customer' as const,
        id: c.id,
        title: c.company ? `${c.name} (${c.company})` : c.name,
        date: c.createdAt.toISOString()
      }))
    ];

    items.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
    const recent = items.slice(0, 20);

    res.json(recent);
  } catch (error) {
    console.error('Get my activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
};

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

/**
 * Upload avatar for current user. Expects multipart field "avatar" (image file).
 * Stores file in uploads/avatars and sets user.avatarUrl to /uploads/avatars/filename.
 */
export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!req.file || !req.file.path) {
      res.status(400).json({ error: 'No avatar file uploaded' });
      return;
    }
    const relativePath = `/uploads/avatars/${path.basename(req.file.path)}`;
    const previous = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true }
    });
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: relativePath },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        role: true,
        catalogId: true,
        avatarUrl: true,
        address: true,
        phone: true,
        defaultTerms: true,
        updatedAt: true
      }
    });
    if (previous?.avatarUrl) {
      const oldPath = path.join(uploadDir, previous.avatarUrl.replace(/^\/uploads\/?/, ''));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    res.json(updatedUser);
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};
