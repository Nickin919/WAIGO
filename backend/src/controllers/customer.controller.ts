import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get companies (distributor company names) for RSM - distinct company names from distributors assigned to this RSM.
 * GET /api/customers/companies
 */
export const getCompaniesForRsm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = (req.user.role || '').toUpperCase();
    if (role !== 'RSM' && role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const distributors = await prisma.user.findMany({
      where: {
        role: { in: ['DISTRIBUTOR', 'DISTRIBUTOR_REP'] },
        assignedToRsmId: req.user.id,
        companyName: { not: null },
      },
      select: { companyName: true },
    });

    const companies = [...new Set(distributors.map((d) => d.companyName!).filter(Boolean))].sort();
    res.json({ companies });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

/**
 * Get customers for the current user (and subordinates for RSM when companyName is provided)
 */
export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { search, companyName } = req.query;
    const role = (req.user.role || '').toUpperCase();
    const isRsm = role === 'RSM' || role === 'ADMIN';

    let createdByIdIn: string[] | null = null;

    if (isRsm && typeof companyName === 'string' && companyName.trim()) {
      const cn = companyName.trim();
      const distributors = await prisma.user.findMany({
        where: {
          role: { in: ['DISTRIBUTOR', 'DISTRIBUTOR_REP'] },
          assignedToRsmId: req.user.id,
          companyName: { equals: cn, mode: 'insensitive' },
        },
        select: { id: true },
      });
      const distributorIds = distributors.map((d) => d.id);
      if (distributorIds.length === 0) {
        res.json([]);
        return;
      }
      const underDistributors = await prisma.user.findMany({
        where: {
          OR: [
            { id: { in: distributorIds } },
            { assignedToDistributorId: { in: distributorIds } },
          ],
        },
        select: { id: true },
      });
      createdByIdIn = underDistributors.map((u) => u.id);
    }

    const where: any =
      createdByIdIn != null
        ? { createdById: { in: createdByIdIn } }
        : { createdById: req.user.id };

    if (typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { company: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

/**
 * Create a new customer
 */
export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, company, email, phone, address, city, state, zipCode } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        company: company?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipCode: zipCode?.trim() || null,
        createdById: req.user.id,
      },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
};

/**
 * Update a customer. Only the user who created the customer can update it.
 */
export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, company, email, phone, address, city, state, zipCode } = req.body;

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    if (existing.createdById !== req.user.id) {
      res.status(403).json({ error: 'You can only update customers you created' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = typeof name === 'string' ? name.trim() : null;
    if (company !== undefined) data.company = company == null || company === '' ? null : String(company).trim();
    if (email !== undefined) data.email = email == null || email === '' ? null : String(email).trim();
    if (phone !== undefined) data.phone = phone == null || phone === '' ? null : String(phone).trim();
    if (address !== undefined) data.address = address == null || address === '' ? null : String(address).trim();
    if (city !== undefined) data.city = city == null || city === '' ? null : String(city).trim();
    if (state !== undefined) data.state = state == null || state === '' ? null : String(state).trim();
    if (zipCode !== undefined) data.zipCode = zipCode == null || zipCode === '' ? null : String(zipCode).trim();

    if (!data.name && Object.keys(data).length === 1) {
      res.status(400).json({ error: 'Customer name cannot be empty' });
      return;
    }
    if (data.name === '') {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: data as any,
    });

    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

/**
 * Bulk create customers from an array. All are created for the current user.
 * Body: { customers: Array<{ name: string, company?, email?, phone?, address?, city?, state?, zipCode? }> }
 */
export const bulkCreateCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { customers: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'customers array is required and must not be empty' });
      return;
    }

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row?.name != null ? String(row.name).trim() : '';
      if (!name) {
        errors.push({ row: i + 1, error: 'Name is required' });
        continue;
      }
      try {
        const customer = await prisma.customer.create({
          data: {
            name,
            company: row.company != null && row.company !== '' ? String(row.company).trim() : null,
            email: row.email != null && row.email !== '' ? String(row.email).trim() : null,
            phone: row.phone != null && row.phone !== '' ? String(row.phone).trim() : null,
            address: row.address != null && row.address !== '' ? String(row.address).trim() : null,
            city: row.city != null && row.city !== '' ? String(row.city).trim() : null,
            state: row.state != null && row.state !== '' ? String(row.state).trim() : null,
            zipCode: row.zipCode != null && row.zipCode !== '' ? String(row.zipCode).trim() : null,
            createdById: req.user.id,
          },
        });
        created.push(customer);
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || 'Failed to create' });
      }
    }

    res.status(201).json({ created: created.length, totalRows: rows.length, customers: created, errors });
  } catch (error) {
    console.error('Bulk create customers error:', error);
    res.status(500).json({ error: 'Failed to create customers' });
  }
};

/**
 * Delete a customer. Only the user who created the customer can delete it.
 * Quotes that reference this customer will have customerId set to null (customer name/email preserved on quote).
 */
export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    if (customer.createdById !== req.user.id) {
      res.status(403).json({ error: 'You can only delete customers you created' });
      return;
    }

    await prisma.$transaction([
      prisma.quote.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      prisma.customer.delete({ where: { id } }),
    ]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};
