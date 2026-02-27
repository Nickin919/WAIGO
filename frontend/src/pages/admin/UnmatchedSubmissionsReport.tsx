import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Filter, RefreshCw, Search } from 'lucide-react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

type UnmatchedStatus = 'OPEN' | 'ACKNOWLEDGED';
type UnmatchedEventType = 'PART_NOT_FOUND' | 'SERIES_NOT_FOUND' | 'CROSS_REF_NOT_FOUND' | 'INVALID_SUBMISSION';

interface UnmatchedSubmissionRow {
  id: string;
  createdAt: string;
  eventType: UnmatchedEventType;
  source: string;
  process: string;
  submittedValue: string;
  submittedField: string;
  submittedManufacturer: string | null;
  matchedAgainst: string | null;
  userId: string | null;
  importBatchId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  status: UnmatchedStatus;
  acknowledgedAt: string | null;
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  acknowledgedBy: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
}

const EVENT_TYPE_LABELS: Record<UnmatchedEventType, string> = {
  PART_NOT_FOUND: 'Part not found',
  SERIES_NOT_FOUND: 'Series not found',
  CROSS_REF_NOT_FOUND: 'Cross-ref not found',
  INVALID_SUBMISSION: 'Invalid submission',
};

const UnmatchedSubmissionsReport = () => {
  const [events, setEvents] = useState<UnmatchedSubmissionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [ackingId, setAckingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit, offset };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (eventTypeFilter) params.eventType = eventTypeFilter;
      if (q.trim()) params.q = q.trim();
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const { data } = await adminApi.getUnmatchedSubmissions(params);
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error('Failed to load unmatched submissions');
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, sourceFilter, eventTypeFilter, offset]);

  const handleSearch = () => {
    setOffset(0);
    load();
  };

  const handleAck = async (id: string) => {
    setAckingId(id);
    try {
      await adminApi.ackUnmatchedSubmission(id);
      toast.success('Marked as acknowledged');
      load();
    } catch (e) {
      toast.error('Failed to acknowledge');
    } finally {
      setAckingId(null);
    }
  };

  const sources = Array.from(new Set(events.map((e) => e.source))).sort();
  const sourceOptions = sourceFilter && !sources.includes(sourceFilter)
    ? [sourceFilter, ...sources]
    : sources;

  return (
    <div className="container-custom py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Unmatched Submissions Report</h1>
      <p className="text-gray-600 mb-6">Part numbers or series not found during uploads, imports, or lookups. Default: last 90 days.</p>

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
          </select>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setOffset(0); }}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="">All sources</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={eventTypeFilter}
          onChange={(e) => { setEventTypeFilter(e.target.value); setOffset(0); }}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="">All event types</option>
          {(Object.keys(EVENT_TYPE_LABELS) as UnmatchedEventType[]).map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
          title="From date (optional)"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
          title="To date (optional)"
        />
        <input
          type="text"
          placeholder="Search value, manufacturer, process..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="border border-gray-300 rounded px-2 py-1 min-w-[180px]"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="btn btn-secondary"
        >
          Apply
        </button>
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
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Source</th>
                  <th className="text-left p-3 font-semibold">Process</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-left p-3 font-semibold">Submitted</th>
                  <th className="text-left p-3 font-semibold">Manufacturer</th>
                  <th className="text-left p-3 font-semibold">User</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-gray-500">
                      No unmatched submissions found.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3 text-gray-600">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-xs">{e.source}</td>
                      <td className="p-3 max-w-[120px] truncate" title={e.process}>{e.process}</td>
                      <td className="p-3">{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</td>
                      <td className="p-3 font-medium">{e.submittedValue}</td>
                      <td className="p-3 text-gray-600">{e.submittedManufacturer ?? '—'}</td>
                      <td className="p-3 text-gray-600">
                        {e.user ? [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.user.email || e.user.id : '—'}
                      </td>
                      <td className="p-3">
                        {e.status === 'ACKNOWLEDGED' ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Acked
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          <Link
                            to={`/admin/product-inspection?partNumber=${encodeURIComponent(e.submittedValue)}`}
                            className="text-wago-green hover:underline flex items-center gap-1"
                          >
                            <Search className="w-4 h-4" /> Inspect
                          </Link>
                          {e.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => handleAck(e.id)}
                              disabled={ackingId !== null}
                              className="text-green-600 hover:underline"
                            >
                              {ackingId === e.id ? '...' : 'Ack'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-gray-500 text-sm">
            <span>
              Showing {events.length} of {total}
              {total > limit && ` (page ${Math.floor(offset / limit) + 1})`}
            </span>
            {total > limit && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  disabled={offset === 0}
                  className="btn btn-secondary text-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + limit)}
                  disabled={offset + limit >= total}
                  className="btn btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnmatchedSubmissionsReport;
