import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { quoteApi } from '@/lib/api';

const QuoteDetail = () => {
  const { quoteId } = useParams();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quoteId && quoteId !== 'new') {
      quoteApi.getById(quoteId).then((res) => setQuote(res.data)).catch(() => toast.error('Failed to load quote')).finally(() => setLoading(false));
    }
  }, [quoteId]);

  const handleDelete = () => {
    if (!quoteId || !window.confirm('Delete this quote?')) return;
    quoteApi.delete(quoteId).then(() => {
      toast.success('Quote deleted');
      window.location.href = '/quotes';
    }).catch(() => toast.error('Failed to delete'));
  };

  const handleDownload = () => {
    if (!quoteId) return;
    quoteApi.downloadCSV(quoteId).then((res) => {
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${quote?.quoteNumber || quoteId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => toast.error('Download failed'));
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading || !quote) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const items = quote.items || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/quotes" className="text-green-600 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" /> Back
          </Link>
          <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/quotes/${quoteId}/edit`} className="btn bg-gray-200 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
          <button onClick={handleDownload} className="btn bg-gray-200 flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleDelete} className="btn bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Customer</h3>
          <p className="font-medium">{quote.customerName || '—'}</p>
        </div>
        {quote.notes && (
          <div>
            <h3 className="text-sm font-medium text-gray-500">Notes</h3>
            <p>{quote.notes}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Line Items</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Part Number</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{item.snapshotPartNumber || item.partNumber}</td>
                  <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{item.snapshotDescription || item.description}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.sellPrice ?? item.costPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-4 border-t flex justify-end">
            <span className="text-xl font-bold">Total: {formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteDetail;
