import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Download, Trash2, Mail, BookOpen, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { quoteApi } from '@/lib/api';

const QuoteDetail = () => {
  const { quoteId } = useParams();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachedLiterature, setAttachedLiterature] = useState<any[]>([]);
  const [suggestedLiterature, setSuggestedLiterature] = useState<any[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);

  useEffect(() => {
    if (quoteId && quoteId !== 'new') {
      quoteApi.getById(quoteId).then((res) => setQuote(res.data)).catch(() => toast.error('Failed to load quote')).finally(() => setLoading(false));
    }
  }, [quoteId]);

  const attachedIds = (attachedLiterature || []).map((ql: any) => ql.literatureId || ql.literature?.id).filter(Boolean);

  useEffect(() => {
    if (!quoteId || quoteId === 'new') return;
    quoteApi.getQuoteLiterature(quoteId).then((res) => setAttachedLiterature(res.data || [])).catch(() => {});
    quoteApi.getSuggestedLiterature(quoteId).then((res) => setSuggestedLiterature(res.data || [])).catch(() => {});
  }, [quoteId]);

  const handleDelete = () => {
    if (!quoteId || !window.confirm('Delete this quote?')) return;
    if (deleting) return;
    setDeleting(true);
    quoteApi.delete(quoteId).then(() => {
      toast.success('Quote deleted');
      window.location.href = '/quotes';
    }).catch(() => {
      toast.error('Failed to delete');
      setDeleting(false);
    });
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

  const handleEmailQuote = () => {
    if (!quoteId || sending) return;
    const to = quote?.customerEmail?.trim();
    if (!to) {
      const email = window.prompt('No customer email on quote. Enter recipient email:');
      if (!email?.trim()) return;
      sendQuoteTo(email.trim());
      return;
    }
    sendQuoteTo(to);
  };

  const sendQuoteTo = (to: string) => {
    if (!quoteId) return;
    setSending(true);
    quoteApi.sendEmail(quoteId, { to }).then((res) => {
      toast.success(res.data?.message ?? 'Quote sent successfully');
    }).catch((err: any) => {
      const msg = err.response?.data?.error ?? 'Failed to send quote email';
      toast.error(msg);
    }).finally(() => setSending(false));
  };

  const attachLiterature = (literatureIds: string[]) => {
    if (!quoteId) return;
    setAttachingId(literatureIds[0] ?? null);
    quoteApi.attachLiterature(quoteId, literatureIds).then((res) => {
      setAttachedLiterature(res.data || []);
      setSuggestedLiterature((prev) => prev.filter((s) => !literatureIds.includes(s.id)));
      toast.success('Literature attached');
    }).catch(() => toast.error('Failed to attach')).finally(() => setAttachingId(null));
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
          <button onClick={handleEmailQuote} disabled={sending} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
            {sending ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Email quote
          </button>
          <button onClick={handleDownload} className="btn bg-gray-200 flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleDelete} disabled={deleting} className="btn bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2 disabled:opacity-60">
            {deleting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Customer</h3>
          <p className="font-medium">{quote.customerName || '—'}</p>
        </div>
        {quote.priceContract && (
          <div>
            <h3 className="text-sm font-medium text-gray-500">Price contract</h3>
            <p className="font-medium">{quote.priceContract.name}</p>
          </div>
        )}
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
                <tr key={item.id} className={`border-t ${item.isSellAffected ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-4 py-2">
                    <span className={item.isCostAffected || item.isSellAffected ? 'font-bold' : 'font-medium'}>
                      {item.snapshotPartNumber || item.partNumber}
                      {item.isCostAffected && <span className="text-gray-600 ml-0.5">*</span>}
                      {item.isSellAffected && <span className="text-emerald-700 ml-0.5">†</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{item.snapshotDescription || item.description}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className={`px-4 py-2 text-right ${item.isSellAffected ? 'font-bold text-emerald-800' : ''}`}>{formatCurrency(item.sellPrice ?? item.costPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(items.some((i: any) => i.isCostAffected || i.isSellAffected)) && (
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium text-gray-600">*</span> Cost affected by SPA/discount &nbsp;
              <span className="font-medium text-emerald-700">†</span> Sell price from pricing contract
            </p>
          )}
          <div className="mt-4 pt-4 border-t flex justify-end">
            <span className="text-xl font-bold">Total: {formatCurrency(quote.total)}</span>
          </div>
        </div>

        {/* Literature */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> Literature
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            Attached literature is included when you email this quote (as PDF or ZIP).
          </p>
          {attachedLiterature.length > 0 && (
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-700">Attached: </span>
              <span className="text-sm text-gray-600">
                {attachedLiterature.map((ql: any) => ql.literature?.title).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {suggestedLiterature.filter((lit: any) => !attachedIds.includes(lit.id)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedLiterature.filter((lit: any) => !attachedIds.includes(lit.id)).map((lit: any) => (
                <span
                  key={lit.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  {lit.title}
                  <button
                    type="button"
                    onClick={() => attachLiterature([lit.id])}
                    disabled={attachingId === lit.id}
                    className="text-green-600 hover:underline disabled:opacity-50 flex items-center gap-0.5"
                  >
                    {attachingId === lit.id ? (
                      <span className="inline-block w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Plus className="w-3 h-3" /> Attach</>
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}
          {attachedLiterature.length === 0 && suggestedLiterature.filter((lit: any) => !attachedIds.includes(lit.id)).length === 0 && (
            <p className="text-sm text-gray-500">No literature attached or suggested for this quote.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteDetail;
