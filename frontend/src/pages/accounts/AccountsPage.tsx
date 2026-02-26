import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi, catalogApi, priceContractApi, userManagementApi, accountsApi } from '@/lib/api';
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
  account?: { id: string; name: string; type: string } | null;
  assignedToDistributor?: { id: string; email: string | null; companyName: string | null; firstName?: string | null; lastName?: string | null } | null;
  assignedToRsm?: { id: string; email: string | null; firstName?: string | null; lastName?: string | null } | null;
}

interface TreeUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role?: string;
}

const displayName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—';

const AccountsPage = () => {
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

  const effRole = effectiveRole(user?.role ?? '');
  const canManage = user?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effRole);
  const isAdmin = effRole === 'ADMIN';

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    assignmentsApi
      .getUsers({ search: search || undefined, page, limit: 20 })
      .then((res) => {
        const data = res.data as { users: UserRow[]; total: number };
        setUsers(data.users || []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        toast.error('Failed to load accounts');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [canManage, search, page]);

  useEffect(() => {
    if (modal === 'catalogs') {
      catalogApi.getAll().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCatalogs(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name || 'Unnamed' })));
      }).catch(() => setCatalogs([]));
    }
    if (modal === 'contracts') {
      priceContractApi.list().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setContracts(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name || 'Unnamed' })));
      }).catch(() => setContracts([]));
    }
  }, [modal]);

  const handleAssignCatalogs = (catalogIds: string[], primaryCatalogId?: string) => {
    const userIds = Array.from(selectedIds);
    setSubmitting(true);
    assignmentsApi
      .assignCatalogs({ userIds, catalogIds, primaryCatalogId: primaryCatalogId || catalogIds[0] })
      .then(() => {
        toast.success('Project books assigned');
        setModal(null);
        setSelectedIds(new Set());
        assignmentsApi.getUsers({ page, limit: 20, search: search || undefined }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignContracts = (contractIds: string[]) => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one user.');
      return;
    }
    if (!contractIds?.length) {
      toast.error('Select at least one price contract.');
      return;
    }
    setSubmitting(true);
    assignmentsApi
      .assignContracts({ userIds: Array.from(selectedIds), contractIds })
      .then(() => {
        toast.success('Price contracts assigned');
        setModal(null);
        setSelectedIds(new Set());
        assignmentsApi.getUsers({ page, limit: 20, search: search || undefined }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

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

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to accounts.</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4 text-green-600 hover:underline">Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-green-600" />
          Accounts
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Users in your hierarchy. Open a user to set role, hierarchy, company, project books, and price contracts in one place.
        </p>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
            <button type="button" onClick={() => setModal('catalogs')} className="btn bg-gray-200">Assign Project Books</button>
            <button type="button" onClick={() => setModal('contracts')} className="btn bg-gray-200">Assign Price Contracts</button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="btn bg-gray-100 text-gray-600">Clear</button>
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
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Distributor</th>
              <th className="px-4 py-2 text-left">RSM</th>
              <th className="px-4 py-2 text-left">Primary Project Book</th>
              <th className="px-4 py-2 text-left">Project Books / Contracts</th>
              <th className="px-4 py-2 text-left w-24" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No users in your scope.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-2 font-medium">{displayName(u)}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2 text-gray-600">{u.account?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {u.assignedToDistributor?.companyName || u.assignedToDistributor?.email || (u.assignedToDistributor ? displayName(u.assignedToDistributor) : '—')}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{u.assignedToRsm ? displayName(u.assignedToRsm) : '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{u.primaryCatalog?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {(u.assignedCatalogs?.length ?? 0)} project books, {(u.assignedContracts?.length ?? 0)} contracts
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/accounts/${u.id}`}
                      className="inline-flex items-center gap-1 text-green-600 hover:underline font-medium"
                    >
                      Open <ChevronRight className="w-4 h-4" />
                    </Link>
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
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn bg-gray-200 disabled:opacity-50">Previous</button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="btn bg-gray-200 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {modal === 'catalogs' && (
        <CatalogModal
          catalogs={catalogs}
          onAssign={handleAssignCatalogs}
          onClose={() => setModal(null)}
          submitting={submitting}
        />
      )}
      {modal === 'contracts' && (
        <ContractModal
          contracts={contracts}
          onAssign={handleAssignContracts}
          onClose={() => setModal(null)}
          submitting={submitting}
        />
      )}
    </div>
  );
};

function CatalogModal({
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Project Books</h3>
        <p className="text-sm text-gray-600 mb-4">Select project books to assign. Mark one as primary. The Master Catalog is assigned to all users by default.</p>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 px-1">
          <span className="w-4 text-center" title="Assign this project book">Assign</span>
          <span className="w-4 text-center" title="Set as primary project book">Primary</span>
          <span>Project Book</span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {catalogs.map((c) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" title="Assign this project book" />
              <input type="radio" name="primary" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} disabled={!selected.has(c.id)} className="rounded" title="Set as primary" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn bg-gray-200">Cancel</button>
          <button type="button" onClick={() => onAssign(Array.from(selected), primaryId || undefined)} disabled={submitting || selected.size === 0} className="btn btn-primary">
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractModal({
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
          <button type="button" onClick={onClose} className="btn bg-gray-200">Cancel</button>
          <button type="button" onClick={() => onAssign(Array.from(selected))} disabled={submitting || selected.size === 0} className="btn btn-primary">
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountsPage;
