import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Upload, TrendingUp, TrendingDown, Users, Calendar, Trash2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { salesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface MonthlyData {
  month: number;
  monthName: string;
  amount: number;
}

interface TopCustomer {
  code: string;
  name: string;
  total: number;
}

interface SummaryData {
  totalSales: number;
  monthly: MonthlyData[];
  topCustomers: TopCustomer[];
  kpis?: {
    averageMonthly: number;
    peakMonth: string;
    peakMonthAmount: number;
    activeCustomers: number;
  };
}

interface RsmOption {
  id: string;
  email: string | null;
  name: string;
  salesCustomersCount: number;
}

interface TrendingCustomer {
  code: string;
  name: string;
  total: number;
  priorTotal: number;
  growthPercent: number;
}

interface SalesSummaryResponse {
  all: SummaryData;
  direct: SummaryData;
  pos: SummaryData;
  trending: { top10Growing: TrendingCustomer[]; top10Declining: TrendingCustomer[] };
  years?: number[];
}

const COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#ca8a04', '#0891b2', '#db2777', '#65a30d', '#4f46e5'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const SalesDashboard = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<SalesSummaryResponse | null>(null);
  const [view, setView] = useState<'all' | 'direct' | 'pos'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rsms, setRsms] = useState<RsmOption[]>([]);
  const [selectedRsmId, setSelectedRsmId] = useState<string>('');
  const [fileInputKeyDirect, setFileInputKeyDirect] = useState(0);
  const [fileInputKeyPos, setFileInputKeyPos] = useState(0);
  const [directYear, setDirectYear] = useState<number>(new Date().getFullYear());
  const [posMonth, setPosMonth] = useState<number>(new Date().getMonth() + 1);
  const [posYear, setPosYear] = useState<number>(new Date().getFullYear());
  const [viewYear, setViewYear] = useState<number | 'all'>('all');
  const [clearYear, setClearYear] = useState<number>(new Date().getFullYear());
  const [clearMonth, setClearMonth] = useState<number>(new Date().getMonth() + 1);
  const [clearEntireYear, setClearEntireYear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const fetchSummary = (rsmId?: string, year?: number | 'all') => {
    setLoading(true);
    salesApi
      .getSummary(rsmId, year)
      .then((res) => {
        const raw = res.data as SalesSummaryResponse | SummaryData;
        if (raw && 'all' in raw && 'direct' in raw && 'pos' in raw) {
          setData(raw as SalesSummaryResponse);
        } else {
          const flat = raw as SummaryData;
          setData(flat ? {
            all: flat,
            direct: flat,
            pos: flat,
            trending: { top10Growing: [], top10Declining: [] },
            years: [],
          } : null);
        }
      })
      .catch(() => {
        toast.error('Failed to load sales data');
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  const summary = data ? (view === 'direct' ? data.direct : view === 'pos' ? data.pos : data.all) : null;

  useEffect(() => {
    fetchSummary(
      isAdmin && selectedRsmId ? selectedRsmId : undefined,
      viewYear === 'all' ? undefined : viewYear
    );
  }, [isAdmin, selectedRsmId, viewYear]);

  useEffect(() => {
    if (isAdmin) {
      salesApi
        .getRsms()
        .then((res) => setRsms((res.data as RsmOption[]) || []))
        .catch(() => setRsms([]));
    }
  }, [isAdmin]);

  const buildFormData = (file: File, type: 'direct' | 'pos', month?: number, year?: number): FormData => {
    const formData = new FormData();
    formData.append('excel', file);
    formData.append('type', type);
    if (isAdmin && selectedRsmId) formData.append('rsmId', selectedRsmId);
    if (type === 'direct' && year != null) formData.append('year', String(year));
    if (type === 'pos' && month != null) formData.append('month', String(month));
    if (type === 'pos' && year != null) formData.append('year', String(year));
    return formData;
  };

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Only .xlsx or .xls files allowed');
      return;
    }
    setUploading(true);
    try {
      await salesApi.upload(buildFormData(file, 'direct', undefined, directYear));
      toast.success(`Direct sales for ${directYear} uploaded`);
      setFileInputKeyDirect((k) => k + 1);
      fetchSummary(isAdmin && selectedRsmId ? selectedRsmId : undefined, viewYear === 'all' ? undefined : viewYear);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const handlePosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Only .xlsx or .xls files allowed');
      return;
    }
    setUploading(true);
    try {
      const res = await salesApi.upload(buildFormData(file, 'pos', posMonth, posYear));
      const payload = res.data as { rowsProcessed?: number; lineItems?: number };
      const msg = payload?.rowsProcessed != null
        ? `${payload.rowsProcessed} customers for ${MONTH_NAMES[posMonth - 1]} ${posYear}`
        : `POS sales for ${MONTH_NAMES[posMonth - 1]} ${posYear} uploaded`;
      toast.success(msg);
      setFileInputKeyPos((k) => k + 1);
      fetchSummary(isAdmin && selectedRsmId ? selectedRsmId : undefined, viewYear === 'all' ? undefined : viewYear);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      const params: { year: number; month?: number; rsmId?: string } = { year: clearYear };
      if (!clearEntireYear) params.month = clearMonth;
      if (isAdmin && selectedRsmId) params.rsmId = selectedRsmId;
      await salesApi.clearByPeriod(params);
      toast.success(clearEntireYear ? `Cleared all data for ${clearYear}` : `Cleared ${MONTH_NAMES[clearMonth - 1]} ${clearYear}`);
      fetchSummary(isAdmin && selectedRsmId ? selectedRsmId : undefined, viewYear === 'all' ? undefined : viewYear);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to clear data');
    } finally {
      setClearing(false);
    }
  };

  const pieData = (summary?.topCustomers ?? []).map((c) => ({
    name: c.code ? `${c.code} - ${c.name}` : c.name || 'Unknown',
    value: c.total,
  }));

  if (!user || (user.role !== 'RSM' && user.role !== 'ADMIN')) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to the sales dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-gray-600 mt-1">Sales analytics from uploaded Excel data</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* View year: All years or single year */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select
              value={viewYear === 'all' ? 'all' : viewYear}
              onChange={(e) => {
                const v = e.target.value;
                setViewYear(v === 'all' ? 'all' : parseInt(v, 10));
              }}
              className="input max-w-[120px]"
            >
              <option value="all">All years</option>
              {(data?.years?.length
                ? data.years
                : Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i)
              ).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {isAdmin && rsms.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">View RSM:</label>
              <select
                value={selectedRsmId}
                onChange={(e) => setSelectedRsmId(e.target.value)}
                className="input max-w-[200px]"
              >
                <option value="">All RSMs</option>
                {rsms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.salesCustomersCount})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Upload + Clear: three cards in one row so delete is visible */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Direct sales – 12 months + total */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Direct sales (12 months)</h3>
          <p className="text-sm text-gray-600 mb-3">
            Excel with 12 months of direct account sales. <strong>Select the calendar year</strong> this file is for. Column R (Total) is ignored.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Year for this file</label>
              <select
                value={directYear}
                onChange={(e) => setDirectYear(Number(e.target.value))}
                className="input w-[100px]"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              key={fileInputKeyDirect}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploading || (isAdmin && !selectedRsmId)}
              onChange={handleDirectUpload}
            />
            <span className="btn btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload direct (.xlsx)'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            Sheet &quot;ZANALYSIS_PATTERN (8)&quot;, row 7+. D=code, E=name, F–Q=Jan–Dec, R=Total (ignored).
          </p>
        </div>

        {/* POS sales – one month, user selects month */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-2">POS sales (distributors)</h3>
          <p className="text-sm text-gray-600 mb-3">
            One month of POS data. <strong>Choose the month/year this file is for</strong> — the file does not contain a date.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
              <select
                value={posMonth}
                onChange={(e) => setPosMonth(Number(e.target.value))}
                className="input w-[140px]"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={posYear}
                onChange={(e) => setPosYear(Number(e.target.value) || posYear)}
                className="input w-[90px]"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              key={fileInputKeyPos}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploading || (isAdmin && !selectedRsmId)}
              onChange={handlePosUpload}
            />
            <span className="btn btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload POS (.xlsx)'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            Sheet &quot;ZANALYSIS_PATTERN (7)&quot;, row 6+. C=code, E=name, F=amount. &quot;Result&quot; rows skipped.
          </p>
        </div>

        {/* Clear data – same row so it’s easy to find */}
        <div className="card p-4 border-red-100 bg-red-50/30">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            Delete / clear data
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Remove sales data for a month or entire year. Cannot be undone.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
              <select
                value={clearYear}
                onChange={(e) => setClearYear(Number(e.target.value))}
                className="input w-[100px]"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clearEntireYear}
                onChange={(e) => setClearEntireYear(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Entire year</span>
            </label>
            {!clearEntireYear && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                <select
                  value={clearMonth}
                  onChange={(e) => setClearMonth(Number(e.target.value))}
                  className="input w-[140px]"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handleClearData}
              disabled={clearing || (isAdmin && !selectedRsmId)}
              className="btn border border-red-300 bg-white text-red-700 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {clearing ? 'Clearing...' : clearEntireYear ? `Clear ${clearYear}` : `Clear ${MONTH_NAMES[clearMonth - 1]} ${clearYear}`}
            </button>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        <strong>Direct</strong> replaces direct sales for the full year. <strong>POS</strong> replaces only POS data for the selected month (it does not overwrite direct sales). Use &quot;View&quot; above to see All, Direct only, or POS only. To fix a wrong POS month, use &quot;Delete / clear data&quot; then re-upload.
      </p>

      {isAdmin && !selectedRsmId && (
        <p className="text-sm text-amber-600 mb-6">Select an RSM above to upload or clear data on their behalf.</p>
      )}

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">Loading sales data...</p>
        </div>
      ) : !data ? (
        <div className="card p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No sales data yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload an Excel file to get started</p>
        </div>
      ) : (
        <>
          {/* View toggle: All | Direct | POS | Year context */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm text-gray-500">
              Showing: {viewYear === 'all' ? 'All years (combined)' : `Calendar year ${viewYear}`}
            </span>
            <span className="text-sm font-medium text-gray-700">Source:</span>
            <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {(['all', 'direct', 'pos'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    view === v
                      ? 'bg-white text-green-700 shadow border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {v === 'all' ? 'All sales' : v === 'direct' ? 'Direct only' : 'POS only'}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">
              {view === 'all' && 'Combined direct + POS'}
              {view === 'direct' && 'Direct account sales only'}
              {view === 'pos' && 'POS (distributor) sales only'}
            </span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(summary?.totalSales ?? 0)}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Average Monthly</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(summary?.kpis?.averageMonthly ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Peak Month</p>
                  <p className="text-xl font-bold text-gray-900">
                    {summary?.kpis?.peakMonth ?? '—'} ({formatCurrency(summary?.kpis?.peakMonthAmount ?? 0)})
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Customers</p>
                  <p className="text-xl font-bold text-gray-900">{summary?.kpis?.activeCustomers ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Sales {view !== 'all' && `(${view === 'direct' ? 'Direct' : 'POS'})`}</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary?.monthly ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.monthName}
                    />
                    <Bar dataKey="amount" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Top Customers {view !== 'all' && `(${view === 'direct' ? 'Direct' : 'POS'})`}</h3>
              <div className="h-[350px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-medium">{payload[0].payload?.name}</p>
                              <p className="text-green-600">{formatCurrency(payload[0].value as number)}</p>
                            </div>
                          ) : null
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No customer data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trending: Top 10 growing & Top 10 declining (Oct–Dec vs Jul–Sep) */}
          {((data.trending?.top10Growing?.length ?? 0) > 0 || (data.trending?.top10Declining?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Top 10 trending up (sales growth)
                </h3>
                <p className="text-xs text-gray-500 mb-3">Comparing last 3 months vs prior 3 months (same year)</p>
                <ul className="space-y-2">
                  {(data.trending?.top10Growing ?? []).map((c, i) => (
                    <li key={`grow-${c.code}-${i}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate block">{c.name || c.code}</span>
                        <span className="text-xs text-gray-500">{c.code}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-green-600 font-medium">+{c.growthPercent.toFixed(1)}%</span>
                        <span className="text-xs text-gray-500 block">{formatCurrency(c.priorTotal)} → {formatCurrency(c.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Top 10 trending down (declining sales)
                </h3>
                <p className="text-xs text-gray-500 mb-3">Comparing last 3 months vs prior 3 months (same year)</p>
                <ul className="space-y-2">
                  {(data.trending?.top10Declining ?? []).map((c, i) => (
                    <li key={`decl-${c.code}-${i}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate block">{c.name || c.code}</span>
                        <span className="text-xs text-gray-500">{c.code}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-red-600 font-medium">{c.growthPercent.toFixed(1)}%</span>
                        <span className="text-xs text-gray-500 block">{formatCurrency(c.priorTotal)} → {formatCurrency(c.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesDashboard;
