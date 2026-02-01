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
import { Upload, TrendingUp, Users, Calendar } from 'lucide-react';
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

const COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#ca8a04', '#0891b2', '#db2777', '#65a30d', '#4f46e5'];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const SalesDashboard = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rsms, setRsms] = useState<RsmOption[]>([]);
  const [selectedRsmId, setSelectedRsmId] = useState<string>('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const isAdmin = user?.role === 'ADMIN';

  const fetchSummary = (rsmId?: string) => {
    setLoading(true);
    salesApi
      .getSummary(rsmId)
      .then((res) => setData(res.data as SummaryData))
      .catch(() => {
        toast.error('Failed to load sales data');
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary(isAdmin && selectedRsmId ? selectedRsmId : undefined);
  }, [isAdmin, selectedRsmId]);

  useEffect(() => {
    if (isAdmin) {
      salesApi
        .getRsms()
        .then((res) => setRsms((res.data as RsmOption[]) || []))
        .catch(() => setRsms([]));
    }
  }, [isAdmin]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Only .xlsx or .xls files allowed');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('excel', file);
    if (isAdmin && selectedRsmId) {
      formData.append('rsmId', selectedRsmId);
    }
    try {
      await salesApi.upload(formData);
      toast.success('Sales data uploaded');
      setFileInputKey((k) => k + 1);
      fetchSummary(isAdmin && selectedRsmId ? selectedRsmId : undefined);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const pieData = (data?.topCustomers ?? []).map((c) => ({
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

      {/* Upload section */}
      <div className="card p-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            key={fileInputKey}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={uploading || (isAdmin && !selectedRsmId)}
            onChange={handleUpload}
          />
          <span className="btn btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Excel (.xlsx)'}
          </span>
        </label>
        {isAdmin && !selectedRsmId && (
          <p className="text-sm text-amber-600 mt-2">Select an RSM above to upload data on their behalf.</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Expected format: Sheet &quot;ZANALYSIS_PATTERN (8)&quot;, row 7+, Col E=code, F=name, G-R=Jan-Dec
        </p>
      </div>

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
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totalSales)}</p>
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
                    {formatCurrency(data.kpis?.averageMonthly ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Peak Month</p>
                  <p className="text-xl font-bold text-gray-900">
                    {data.kpis?.peakMonth ?? '—'} ({formatCurrency(data.kpis?.peakMonthAmount ?? 0)})
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
                  <p className="text-xl font-bold text-gray-900">{data.kpis?.activeCustomers ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Sales</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
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
              <h3 className="font-semibold text-gray-900 mb-4">Top Customers</h3>
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
        </>
      )}
    </div>
  );
};

export default SalesDashboard;
