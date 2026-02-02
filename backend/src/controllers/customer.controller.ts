import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get customers for the current user (and subordinates for managers)
 */
export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { search } = req.query;
    const where: any = { createdById: req.user.id };

    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
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
