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

const DEFAULT_YEAR = 2025;

/**
 * Parse Direct sales file: ZANALYSIS_PATTERN (8), row 7+, Col D=code, E=name, F–Q=Jan–Dec, R=Total (ignored).
 */
function parseDirectFile(worksheet: ExcelJS.Worksheet): { code: string; name: string; amounts: number[] }[] {
  const dataStartRow = 7;
  const colCode = 4;   // D – Sold-to party
  const colName = 5;   // E – Customer name
  const colJan = 6;    // F – first month (Jan); F–Q = Jan–Dec (12 cols), R(18)=Result ignored

  const rows: { code: string; name: string; amounts: number[] }[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    const code = String(row.getCell(colCode)?.value ?? '').trim();
    const name = String(row.getCell(colName)?.value ?? '').trim();
    if (!code || !name) return;
    const amounts: number[] = [];
    for (let m = 0; m < 12; m++) {
      const cell = row.getCell(colJan + m);
      const val = cell?.value;
      if (val === null || val === undefined || val === '') {
        amounts.push(0);
      } else {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        amounts.push(isNaN(num) ? 0 : Math.max(0, num));
      }
    }
    rows.push({ code, name, amounts });
  });
  return rows;
}

/**
 * Parse POS sales file: ZANALYSIS_PATTERN (7), row 6+, Col C=end customer code, E=name, F=amount.
 * Skip "Result" rows. Returns list of { code, name, amount } (one amount per line; caller aggregates by customer).
 */
function parsePosFile(worksheet: ExcelJS.Worksheet): { code: string; name: string; amount: number }[] {
  const dataStartRow = 6;
  const colCode = 3;   // C – End Customer (code)
  const colName = 5;   // E – Name End Customer
  const colAmount = 6; // F – $ amount

  const rows: { code: string; name: string; amount: number }[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    const code = String(row.getCell(colCode)?.value ?? '').trim();
    const name = String(row.getCell(colName)?.value ?? '').trim();
    if (!code || !name || code === 'Result' || name === 'Result') return;
    const val = row.getCell(colAmount)?.value;
    if (val === null || val === undefined || val === '') return;
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    const amount = isNaN(num) ? 0 : Math.max(0, num);
    if (amount === 0) return;
    rows.push({ code, name, amount });
  });
  return rows;
}

/**
 * POST /api/sales/upload - Upload Excel sales file (RSM/Admin only).
 * Body: type = 'direct' | 'pos' (default 'direct'). For POS: month (1–12) and year required.
 */
export const uploadSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== 'RSM' && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only RSM or Admin can upload sales data' });
      return;
    }

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

    const uploadType = (req.body?.type as string) || 'direct';
    const yearRaw = req.body?.year != null ? parseInt(String(req.body.year), 10) : NaN;
    const year = !isNaN(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : undefined;
    const month = req.body?.month != null ? parseInt(String(req.body.month), 10) : undefined;

    if (uploadType === 'pos') {
      if (month == null || month < 1 || month > 12) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'For POS uploads, select the month (1–12) this data is for' });
        return;
      }
      if (!year) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'For POS uploads, select the year this data is for' });
        return;
      }
    }
    if (uploadType === 'direct') {
      if (!year) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'For Direct uploads, select the calendar year this file is for' });
        return;
      }
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    if (uploadType === 'pos') {
      let worksheet = workbook.getWorksheet('ZANALYSIS_PATTERN (7)');
      if (!worksheet) worksheet = workbook.worksheets[0];
      if (!worksheet) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'No worksheet found in file' });
        return;
      }
      const posRows = parsePosFile(worksheet);
      fs.unlinkSync(req.file.path);
      // Replace only POS data for this RSM + year + month (DIRECT stays intact)
      await prisma.monthlySale.deleteMany({
        where: {
          salesCustomer: { rsmId: effectiveRsmId },
          year,
          month: month!,
          source: 'POS',
        },
      });
      const byCustomer = new Map<string, { code: string; name: string; total: number }>();
      for (const r of posRows) {
        const key = `${r.code}\t${r.name}`;
        const existing = byCustomer.get(key);
        if (existing) existing.total += r.amount;
        else byCustomer.set(key, { code: r.code, name: r.name, total: r.amount });
      }
      let processed = 0;
      for (const { code, name, total } of byCustomer.values()) {
        const salesCustomer = await prisma.salesCustomer.upsert({
          where: { rsmId_code: { rsmId: effectiveRsmId, code } },
          create: { rsmId: effectiveRsmId, code, name },
          update: { name },
        });
        await prisma.monthlySale.upsert({
          where: {
            salesCustomerId_year_month_source: {
              salesCustomerId: salesCustomer.id,
              year,
              month: month!,
              source: 'POS',
            },
          },
          create: {
            salesCustomerId: salesCustomer.id,
            customerCode: code,
            year,
            month: month!,
            amount: total,
            source: 'POS',
          },
          update: { amount: total },
        });
        processed++;
      }
      res.json({ success: true, type: 'pos', rowsProcessed: processed, lineItems: posRows.length });
      return;
    }

    // Direct upload
    let worksheet = workbook.getWorksheet('ZANALYSIS_PATTERN (8)');
    if (!worksheet) worksheet = workbook.worksheets[0];
    if (!worksheet) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'No worksheet found in file' });
      return;
    }
    const rows = parseDirectFile(worksheet);
    fs.unlinkSync(req.file.path);

    if (rows.length === 0) {
      res.json({ success: true, message: 'No valid rows found', rowsProcessed: 0 });
      return;
    }

    const effectiveYear = year!;
    // Replace only DIRECT data for this RSM + year (POS data stays intact)
    await prisma.monthlySale.deleteMany({
      where: {
        salesCustomer: { rsmId: effectiveRsmId },
        year: effectiveYear,
        source: 'DIRECT',
      },
    });
    for (const row of rows) {
      const salesCustomer = await prisma.salesCustomer.upsert({
        where: {
          rsmId_code: { rsmId: effectiveRsmId, code: row.code },
        },
        create: {
          rsmId: effectiveRsmId,
          code: row.code,
          name: row.name,
        },
        update: { name: row.name },
      });
      for (let m = 1; m <= 12; m++) {
        const amount = row.amounts[m - 1];
        if (amount > 0) {
          await prisma.monthlySale.upsert({
            where: {
              salesCustomerId_year_month_source: {
                salesCustomerId: salesCustomer.id,
                year: effectiveYear,
                month: m,
                source: 'DIRECT',
              },
            },
            create: {
              salesCustomerId: salesCustomer.id,
              customerCode: row.code,
              year: effectiveYear,
              month: m,
              amount,
              source: 'DIRECT',
            },
            update: { amount },
          });
        } else {
          await prisma.monthlySale.deleteMany({
            where: {
              salesCustomerId: salesCustomer.id,
              year: effectiveYear,
              month: m,
              source: 'DIRECT',
            },
          });
        }
      }
    }
    res.json({ success: true, type: 'direct', rowsProcessed: rows.length });
  } catch (error) {
    console.error('Sales upload error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process upload' });
  }
};

type SummaryWhere = { salesCustomer?: { rsmId: string }; source?: string; year?: number };

/** Build summary (monthly, topCustomers, kpis) for a given where filter */
async function buildSummary(where: SummaryWhere, customerCount: number) {
  const [sales, topCustomersRaw] = await Promise.all([
    prisma.monthlySale.findMany({
      where,
      select: { amount: true, month: true, year: true, salesCustomerId: true },
    }),
    prisma.monthlySale.groupBy({
      by: ['salesCustomerId'],
      where,
      _sum: { amount: true },
    }),
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
    .map((c) => ({ code: c.code, name: c.name, total: totalByCustomer[c.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const peakMonth = monthly.reduce((best, m) => (m.amount > best.amount ? m : best), { month: 1, monthName: 'January', amount: 0 });
  return {
    totalSales,
    monthly,
    topCustomers,
    kpis: {
      averageMonthly: sales.length > 0 ? totalSales / 12 : 0,
      peakMonth: peakMonth.monthName,
      peakMonthAmount: peakMonth.amount,
      activeCustomers: customerCount,
    },
  };
}

/** Compute top 10 growing and top 10 declining by comparing last 3 months vs prior 3 months (same year) */
async function getTrending(where: SummaryWhere, year?: number): Promise<{ top10Growing: Array<{ code: string; name: string; total: number; priorTotal: number; growthPercent: number }>; top10Declining: Array<{ code: string; name: string; total: number; priorTotal: number; growthPercent: number }> }> {
  const trendYear = year ?? await prisma.monthlySale.aggregate({
    where: { ...where },
    _max: { year: true },
  }).then((r) => r._max.year ?? DEFAULT_YEAR);
  const sales = await prisma.monthlySale.findMany({
    where: { ...where, year: trendYear },
    select: { salesCustomerId: true, month: true, amount: true },
  });
  const recentMonths = [10, 11, 12];
  const priorMonths = [7, 8, 9];
  const byCustomer: Record<string, { recent: number; prior: number }> = {};
  sales.forEach((s) => {
    const id = s.salesCustomerId;
    if (!byCustomer[id]) byCustomer[id] = { recent: 0, prior: 0 };
    const amt = Number(s.amount);
    if (recentMonths.includes(s.month)) byCustomer[id].recent += amt;
    if (priorMonths.includes(s.month)) byCustomer[id].prior += amt;
  });
  const customerIds = Object.keys(byCustomer).filter((id) => byCustomer[id].prior > 0 || byCustomer[id].recent > 0);
  if (customerIds.length === 0) return { top10Growing: [], top10Declining: [] };
  const customers = await prisma.salesCustomer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, code: true, name: true },
  });
  const list = customers.map((c) => {
    const { recent, prior } = byCustomer[c.id] ?? { recent: 0, prior: 0 };
    const growthPercent = prior > 0 ? ((recent - prior) / prior) * 100 : (recent > 0 ? 100 : 0);
    return { code: c.code, name: c.name, total: recent, priorTotal: prior, growthPercent };
  });
  const sorted = [...list].sort((a, b) => b.growthPercent - a.growthPercent);
  return {
    top10Growing: sorted.filter((x) => x.growthPercent > 0).slice(0, 10),
    top10Declining: sorted.filter((x) => x.growthPercent < 0).slice(-10).reverse(),
  };
}

/**
 * GET /api/sales/summary - Sales summary for dashboard (RSM/Admin)
 * Query: year (optional) – filter to one year, or omit for "All years" (combined).
 * Returns all, direct, pos summaries, trending, and years (list of years with data).
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
    const baseWhere: SummaryWhere = rsmFilter ? { salesCustomer: { rsmId: rsmFilter.rsmId } } : {};
    const yearParam = req.query.year as string | undefined;
    const filterYear = yearParam && yearParam !== 'all' ? parseInt(yearParam, 10) : undefined;
    if (yearParam && yearParam !== 'all' && (isNaN(filterYear!) || filterYear! < 2000 || filterYear! > 2100)) {
      res.status(400).json({ error: 'Invalid year (2000–2100 or "all")' });
      return;
    }
    const whereWithYear = filterYear != null ? { ...baseWhere, year: filterYear } : baseWhere;

    const customerCount = rsmFilter
      ? await prisma.salesCustomer.count({ where: { rsmId: rsmFilter.rsmId } })
      : await prisma.salesCustomer.count();

    const [yearsRows, summaryAll, summaryDirect, summaryPos, trending] = await Promise.all([
      prisma.monthlySale.findMany({
        where: baseWhere,
        select: { year: true },
        distinct: ['year'],
        orderBy: { year: 'desc' },
      }),
      buildSummary(whereWithYear, customerCount),
      buildSummary({ ...whereWithYear, source: 'DIRECT' }, customerCount),
      buildSummary({ ...whereWithYear, source: 'POS' }, customerCount),
      getTrending(baseWhere, filterYear),
    ]);
    const years = yearsRows.map((r) => r.year).filter((y) => y != null).sort((a, b) => b - a);

    res.json({
      all: summaryAll,
      direct: summaryDirect,
      pos: summaryPos,
      trending,
      years,
    });
  } catch (error) {
    console.error('Sales summary error:', error);
    res.status(500).json({ error: 'Failed to fetch sales summary' });
  }
};

/**
 * DELETE /api/sales/by-period - Clear sales data by month or by year (RSM/Admin).
 * Body or query: year (required), month (optional, 1–12). If month omitted, clears entire year.
 * Admin can send rsmId to clear for that RSM.
 */
export const clearSalesByPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== 'RSM' && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only RSM or Admin can clear sales data' });
      return;
    }
    const effectiveRsmId =
      req.user.role === 'RSM' ? req.user.id : (req.body?.rsmId ?? req.query?.rsmId as string | undefined);
    if (!effectiveRsmId) {
      res.status(400).json({ error: 'Select an RSM to clear data for (Admin)' });
      return;
    }
    const year = req.body?.year ?? req.query?.year;
    const month = req.body?.month ?? req.query?.month;
    const yearNum = year != null ? parseInt(String(year), 10) : NaN;
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      res.status(400).json({ error: 'Valid year (2000–2100) required' });
      return;
    }
    const where: { salesCustomer: { rsmId: string }; year: number; month?: number } = {
      salesCustomer: { rsmId: effectiveRsmId },
      year: yearNum,
    };
    if (month != null) {
      const monthNum = parseInt(String(month), 10);
      if (monthNum < 1 || monthNum > 12) {
        res.status(400).json({ error: 'Month must be 1–12' });
        return;
      }
      where.month = monthNum;
    }
    const result = await prisma.monthlySale.deleteMany({ where });
    res.json({
      success: true,
      deleted: result.count,
      year: yearNum,
      ...(where.month != null ? { month: where.month } : {}),
    });
  } catch (error) {
    console.error('Clear sales by period error:', error);
    res.status(500).json({ error: 'Failed to clear sales data' });
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
