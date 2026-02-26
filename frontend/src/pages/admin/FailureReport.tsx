import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Filter, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

type FailureReportSource = 'BOM_UPLOAD' | 'PROJECT_BOOK_CONVERSION' | 'CROSS_REF_IMPORT';

interface FailureReportRow {
  id: string;
  source: FailureReportSource;
  failureType: string;
  importBatchId: string | null;
  context: Record<string, unknown> | null;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  resolvedBy: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
}

const SOURCE_LABELS: Record<FailureReportSource, string> = {
  BOM_UPLOAD: 'BOM Upload',
  PROJECT_BOOK_CONVERSION: 'Project Book Conversion',
  CROSS_REF_IMPORT: 'Cross-Ref Import',
};

const FailureReport = () => {
  const [reports, setReports] = useState<FailureReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [modalId, setModalId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (!showResolved) params.resolved = 'false';
      if (sourceFilter) params.source = sourceFilter;
      const { data } = await adminApi.getFailureReports(params);
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error('Failed to load failure reports');
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [showResolved, sourceFilter]);

  const handleResolve = async () => {
    if (!modalId || !resolveNote.trim()) return;
    setResolvingId(modalId);
    try {
      await adminApi.resolveFailureReport(modalId, resolveNote.trim());
      toast.success('Marked as resolved');
      setModalId(null);
      setResolveNote('');
      load();
    } catch (e) {
      toast.error('Failed to resolve');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="container-custom py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Failure Report</h1>

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Show resolved</span>
        </label>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All sources</option>
            {(Object.keys(SOURCE_LABELS) as FailureReportSource[]).map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Source</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-left p-3 font-semibold">Message</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Resolved</th>
                  <th className="text-left p-3 font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No failure reports found.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3">{SOURCE_LABELS[r.source] ?? r.source}</td>
                      <td className="p-3 font-mono text-xs">{r.failureType}</td>
                      <td className="p-3 max-w-md truncate" title={r.message}>{r.message}</td>
                      <td className="p-3 text-gray-600">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {r.resolvedAt ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            {new Date(r.resolvedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Unresolved
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {!r.resolvedAt && (
                          <button
                            type="button"
                            onClick={() => { setModalId(r.id); setResolveNote(''); }}
                            className="text-green-600 hover:underline"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > reports.length && (
            <div className="p-3 border-t border-gray-100 text-gray-500 text-sm">
              Showing {reports.length} of {total}. Use filters to narrow.
            </div>
          )}
        </div>
      )}

      {modalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Resolve failure report</h3>
            <p className="text-gray-600 text-sm mb-4">Resolution note is required.</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="What action was taken?"
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setModalId(null); setResolveNote(''); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={!resolveNote.trim() || resolvingId !== null}
                className="btn btn-primary"
              >
                {resolvingId ? 'Saving...' : 'Mark resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FailureReport;
