import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { assignmentsApi, catalogApi, priceContractApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';

interface UserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  primaryCatalog: { id: string; name: string } | null;
  assignedCatalogs: { id: string; name: string }[];
  assignedContracts: { id: string; name: string }[];
  turnkeyTeam?: { id: string; name: string } | null;
}

const AssignmentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<'catalogs' | 'contracts' | null>(null);
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effectiveRole(user.role));

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    assignmentsApi.getUsers({ search: search || undefined, page, limit: 20 }).then((res) => {
      const data = res.data as { users: UserRow[]; total: number };
      setUsers(data.users || []);
      setTotal(data.total ?? 0);
    }).catch(() => {
      toast.error('Failed to load users');
      setUsers([]);
    }).finally(() => setLoading(false));
  }, [canManage, search, page]);

  useEffect(() => {
    if (modal === 'catalogs') {
      catalogApi.getAll().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCatalogs(list.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
      }).catch(() => setCatalogs([]));
    }
    if (modal === 'contracts') {
      priceContractApi.list().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setContracts(list.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
      }).catch(() => setContracts([]));
    }
  }, [modal]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  const handleAssignCatalogs = (catalogIds: string[], primaryCatalogId?: string) => {
    if (catalogIds.length === 0) {
      toast.error('Select at least one catalog');
      return;
    }
    setSubmitting(true);
    assignmentsApi.assignCatalogs({
      userIds: Array.from(selectedIds),
      catalogIds,
      primaryCatalogId: primaryCatalogId || catalogIds[0],
    }).then(() => {
      toast.success('Catalogs assigned');
      setModal(null);
      setSelectedIds(new Set());
      assignmentsApi.getUsers({ page, limit: 20 }).then((r) => {
        const d = r.data as { users: UserRow[] };
        setUsers(d.users || []);
      });
    }).catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign')).finally(() => setSubmitting(false));
  };

  const handleAssignContracts = (contractIds: string[]) => {
    if (contractIds.length === 0) {
      toast.error('Select at least one price contract');
      return;
    }
    setSubmitting(true);
    assignmentsApi.assignContracts({ userIds: Array.from(selectedIds), contractIds }).then(() => {
      toast.success('Price contracts assigned');
      setModal(null);
      setSelectedIds(new Set());
      assignmentsApi.getUsers({ page, limit: 20 }).then((r) => {
        const d = r.data as { users: UserRow[] };
        setUsers(d.users || []);
      });
    }).catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign')).finally(() => setSubmitting(false));
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to user assignments.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-green-600 hover:underline">Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-2xl font-bold">User & Catalog Assignments</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input max-w-xs"
        />
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
            <button onClick={() => setModal('catalogs')} className="btn bg-gray-200">Assign Catalogs</button>
            <button onClick={() => setModal('contracts')} className="btn bg-gray-200">Assign Price Contracts</button>
            <button onClick={() => setSelectedIds(new Set())} className="btn bg-gray-100 text-gray-600">Clear</button>
          </div>
        )}
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left w-10">
                <input type="checkbox" checked={users.length > 0 && selectedIds.size === users.length} onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Primary Catalog</th>
              <th className="px-4 py-2 text-left">Assigned Catalogs</th>
              <th className="px-4 py-2 text-left">Price Contracts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No users in your scope.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-2 font-medium">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2">{u.turnkeyTeam?.name ?? '—'}</td>
                  <td className="px-4 py-2">{u.primaryCatalog?.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(u.assignedCatalogs || []).map((c) => (
                        <span key={c.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{c.name}</span>
                      ))}
                      {(u.assignedCatalogs?.length ?? 0) === 0 && '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(u.assignedContracts || []).map((c) => (
                        <span key={c.id} className="px-2 py-0.5 bg-blue-50 rounded text-xs">{c.name}</span>
                      ))}
                      {(u.assignedContracts?.length ?? 0) === 0 && '—'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm text-gray-600">Total {total} users</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn bg-gray-200 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="btn bg-gray-200 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {modal === 'catalogs' && (
        <AssignmentCatalogModal
          catalogs={catalogs}
          onAssign={handleAssignCatalogs}
          onClose={() => setModal(null)}
          submitting={submitting}
        />
      )}
      {modal === 'contracts' && (
        <AssignmentContractModal
          contracts={contracts}
          onAssign={handleAssignContracts}
          onClose={() => setModal(null)}
          submitting={submitting}
        />
      )}
    </div>
  );
};

function AssignmentCatalogModal({
  catalogs,
  onAssign,
  onClose,
  submitting,
}: {
  catalogs: { id: string; name: string }[];
  onAssign: (catalogIds: string[], primaryCatalogId?: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string>('');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    const ids = Array.from(selected);
    onAssign(ids, primaryId || ids[0]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Catalogs</h3>
        <p className="text-sm text-gray-600 mb-4">Select catalogs to assign. One will be set as primary.</p>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {catalogs.map((c) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
              <input type="radio" name="primary" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} disabled={!selected.has(c.id)} className="rounded" title="Primary" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || selected.size === 0} className="btn btn-primary">
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentContractModal({
  contracts,
  onAssign,
  onClose,
  submitting,
}: {
  contracts: { id: string; name: string }[];
  onAssign: (contractIds: string[]) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Price Contracts</h3>
        <p className="text-sm text-gray-600 mb-4">Select price contracts to assign to selected users.</p>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {contracts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn bg-gray-200">Cancel</button>
          <button onClick={() => onAssign(Array.from(selected))} disabled={submitting || selected.size === 0} className="btn btn-primary">
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssignmentsPage;
