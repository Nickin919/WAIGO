import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, ChevronRight } from 'lucide-react';
import { quoteApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Quote {
  id: string;
  quoteNumber: string;
  customerName?: string | null;
  total: number;
  createdAt: string;
  _count?: { items: number };
}

const Quotes = () => {
  const { user } = useAuthStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quoteApi.getAll().then((res) => {
      setQuotes(Array.isArray(res.data) ? res.data : []);
    }).catch(() => setQuotes([])).finally(() => setLoading(false));
  }, []);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
        <Link to="/quotes/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Quote
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No quotes yet</p>
          <Link to="/quotes/new" className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create your first quote
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y">
            {quotes.map((q) => (
              <Link key={q.id} to={`/quotes/${q.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div>
                  <div className="font-semibold text-gray-900">{q.quoteNumber}</div>
                  <div className="text-sm text-gray-500">{q.customerName || 'No customer'}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(q.total)}</div>
                    <div className="text-xs text-gray-500">{q._count?.items ?? 0} items</div>
                  </div>
                  <div className="text-sm text-gray-500">{formatDate(q.createdAt)}</div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotes;
