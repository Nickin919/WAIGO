import { Response } from 'express';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Get RSM filter: RSM sees own data, Admin sees all or optional ?rsmId=
 */
function getRsmFilter(req: AuthRequest): { rsmId?: string } | undefined {
  if (req.user?.role === 'ADMIN') {
    const rsmId = req.query.rsmId as string | undefined;
    if (rsmId) return { rsmId };
    return undefined; // Admin with no filter = all data
  }
  if (req.user?.role === 'RSM') {
    return { rsmId: req.user.id };
  }
  return undefined;
}

/**
 * POST /api/sales/upload - Upload Excel sales file (RSM/Admin only)
 * Parses ZANALYSIS_PATTERN format: row 7+, Col E=code, F=name, G-R=Jan-Dec amounts
 */
export const uploadSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Only RSM can upload (Admin could add later if needed)
    if (req.user.role !== 'RSM' && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only RSM or Admin can upload sales data' });
      return;
    }

    // RSM uploads their own data; Admin must specify rsmId in body to upload on behalf of RSM
    const effectiveRsmId =
      req.user.role === 'RSM' ? req.user.id : (req.body?.rsmId as string | undefined);
    if (!effectiveRsmId) {
      res.status(400).json({
        error: req.user.role === 'ADMIN'
          ? 'Select an RSM to upload data on their behalf'
          : 'Unable to determine RSM',
      });
      return;
    }

    if (!req.file || !req.file.path) {
      res.status(400).json({ error: 'Excel file required' });
      return;
    }

    const ext = req.file.originalname?.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls') {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Only .xlsx or .xls files allowed' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    let worksheet = workbook.getWorksheet('ZANALYSIS_PATTERN (8)');
    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }
    if (!worksheet) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'No worksheet found in file' });
      return;
    }

    const year = 2025;
    const dataStartRow = 7;
    const colCode = 5;   // E
    const colName = 6;   // F
    const colJan = 7;    // G

    const rows: { code: string; name: string; amounts: number[] }[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const codeCell = row.getCell(colCode);
      const nameCell = row.getCell(colName);
      const code = String(codeCell?.value ?? '').trim();
      const name = String(nameCell?.value ?? '').trim();

      if (!code || !name) return;

      const amounts: number[] = [];
      for (let m = 0; m < 12; m++) {
        const cell = row.getCell(colJan + m);
        let val = cell?.value;
        if (val === null || val === undefined || val === '') {
          amounts.push(0);
        } else {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          amounts.push(isNaN(num) ? 0 : Math.max(0, num));
        }
      }

      rows.push({ code, name, amounts });
    });

    fs.unlinkSync(req.file.path);

    if (rows.length === 0) {
      res.json({ success: true, message: 'No valid rows found', rowsProcessed: 0 });
      return;
    }

    for (const row of rows) {
      const salesCustomer = await prisma.salesCustomer.upsert({
        where: {
          rsmId_code: {
            rsmId: effectiveRsmId,
            code: row.code,
          },
        },
        create: {
          rsmId: effectiveRsmId,
          code: row.code,
          name: row.name,
        },
        update: { name: row.name },
      });

      for (let month = 1; month <= 12; month++) {
        const amount = row.amounts[month - 1];
        if (amount > 0) {
          await prisma.monthlySale.upsert({
            where: {
              salesCustomerId_year_month: {
                salesCustomerId: salesCustomer.id,
                year,
                month,
              },
            },
            create: {
              salesCustomerId: salesCustomer.id,
              customerCode: row.code,
              year,
              month,
              amount,
            },
            update: { amount },
          });
        } else {
          await prisma.monthlySale.deleteMany({
            where: {
              salesCustomerId: salesCustomer.id,
              year,
              month,
            },
          });
        }
      }
    }

    res.json({ success: true, rowsProcessed: rows.length });
  } catch (error) {
    console.error('Sales upload error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process upload' });
  }
};

/**
 * GET /api/sales/summary - Sales summary for dashboard (RSM/Admin)
 * RSM sees own; Admin sees all or ?rsmId= for specific RSM
 */
export const getSalesSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'RSM' && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only RSM or Admin can view sales dashboard' });
      return;
    }

    const rsmFilter = getRsmFilter(req);

    const where = rsmFilter ? { salesCustomer: { rsmId: rsmFilter.rsmId } } : {};

    const [sales, topCustomersRaw, customerCount] = await Promise.all([
      prisma.monthlySale.findMany({
        where,
        select: { amount: true, month: true, year: true },
      }),
      prisma.monthlySale.groupBy({
        by: ['salesCustomerId'],
        where,
        _sum: { amount: true },
      }),
      rsmFilter
        ? prisma.salesCustomer.count({ where: { rsmId: rsmFilter.rsmId } })
        : prisma.salesCustomer.count(),
    ]);

    const totalSales = sales.reduce((sum, s) => sum + Number(s.amount), 0);

    const monthlyMap: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthlyMap[m] = 0;
    sales.forEach((s) => {
      monthlyMap[s.month] = (monthlyMap[s.month] ?? 0) + Number(s.amount);
    });

    const monthly = Object.entries(monthlyMap).map(([m, amount]) => ({
      month: parseInt(m, 10),
      monthName: MONTH_NAMES[parseInt(m, 10) - 1],
      amount,
    }));

    const topIds = topCustomersRaw
      .sort((a, b) => (Number(b._sum.amount) ?? 0) - (Number(a._sum.amount) ?? 0))
      .slice(0, 10)
      .map((t) => t.salesCustomerId);

    const customers = await prisma.salesCustomer.findMany({
      where: { id: { in: topIds } },
      select: { id: true, code: true, name: true },
    });

    const totalByCustomer = topCustomersRaw
      .filter((t) => topIds.includes(t.salesCustomerId))
      .reduce((acc, t) => {
        acc[t.salesCustomerId] = Number(t._sum.amount) ?? 0;
        return acc;
      }, {} as Record<string, number>);

    const topCustomers = customers
      .map((c) => ({
        code: c.code,
        name: c.name,
        total: totalByCustomer[c.id] ?? 0,
      }))
      .sort((a, b) => b.total - a.total);

    const peakMonth = monthly.reduce((best, m) => (m.amount > best.amount ? m : best), { month: 1, monthName: 'January', amount: 0 });

    res.json({
      totalSales,
      monthly,
      topCustomers,
      kpis: {
        averageMonthly: sales.length > 0 ? totalSales / 12 : 0,
        peakMonth: peakMonth.monthName,
        peakMonthAmount: peakMonth.amount,
        activeCustomers: customerCount,
      },
    });
  } catch (error) {
    console.error('Sales summary error:', error);
    res.status(500).json({ error: 'Failed to fetch sales summary' });
  }
};

/**
 * GET /api/sales/rsms - List RSMs for Admin dropdown
 */
export const getRsms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const rsms = await prisma.user.findMany({
      where: { role: 'RSM', isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        _count: { select: { salesCustomers: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    res.json(rsms.map((r) => ({
      id: r.id,
      email: r.email,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || '—',
      salesCustomersCount: r._count.salesCustomers,
    })));
  } catch (error) {
    console.error('Get RSMs error:', error);
    res.status(500).json({ error: 'Failed to fetch RSMs' });
  }
};
