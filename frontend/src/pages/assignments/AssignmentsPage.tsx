import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, UserCog, Building } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
}

interface TreeUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role?: string;
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
  const [modal, setModal] = useState<'catalogs' | 'contracts' | 'distributor' | 'rsm' | 'company' | null>(null);
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [distributors, setDistributors] = useState<TreeUser[]>([]);
  const [rsms, setRsms] = useState<TreeUser[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [selectedRsmId, setSelectedRsmId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effRole = effectiveRole(user?.role ?? '');
  const canManage = user?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effRole);
  const canAssignToDistributor = effRole === 'ADMIN' || effRole === 'RSM';
  const canAssignDistributorToRsm = effRole === 'ADMIN';
  const isAdmin = effRole === 'ADMIN';
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);

  const ROLE_OPTIONS: { value: string; label: string }[] = [
    { value: 'FREE', label: 'Free / Guest' },
    { value: 'BASIC_USER', label: 'Basic User' },
    { value: 'BASIC', label: 'Basic (legacy)' },
    { value: 'DIRECT_USER', label: 'Direct User' },
    { value: 'TURNKEY', label: 'TurnKey (legacy)' },
    { value: 'DISTRIBUTOR_REP', label: 'Distributor' },
    { value: 'DISTRIBUTOR', label: 'Distributor (legacy)' },
    { value: 'RSM', label: 'RSM' },
    { value: 'ADMIN', label: 'Admin' },
  ];

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
    if (!canAssignToDistributor && !canAssignDistributorToRsm) return;
    assignmentsApi.getTree().then((res) => {
      const data = res.data as { rsms?: TreeUser[]; distributors?: TreeUser[] };
      setDistributors(data.distributors ?? []);
      setRsms(data.rsms ?? []);
    }).catch(() => {
      setDistributors([]);
      setRsms([]);
    });
  }, [canAssignToDistributor, canAssignDistributorToRsm]);

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
    if (modal === 'company') {
      accountsApi.getList().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setAccounts(list);
        setSelectedAccountId(list[0]?.id ?? '');
      }).catch(() => setAccounts([]));
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

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));
  const selectedCustomers = selectedUsers.filter((u) => !['ADMIN', 'RSM'].includes(effectiveRole(u.role)));
  const selectedDistributors = selectedUsers.filter((u) => ['DISTRIBUTOR_REP', 'DISTRIBUTOR'].includes(effectiveRole(u.role)));
  const showAssignToDistributor = canAssignToDistributor && selectedCustomers.length > 0;
  const showAssignToRsm = canAssignDistributorToRsm && selectedDistributors.length > 0;

  const handleAssignToDistributor = () => {
    if (!selectedDistributorId || selectedCustomers.length === 0) return;
    setSubmitting(true);
    const promises = selectedCustomers.map((u) =>
      userManagementApi.assignToDistributor({ userId: u.id, distributorId: selectedDistributorId })
    );
    Promise.all(promises)
      .then(() => {
        toast.success(`Assigned ${selectedCustomers.length} user(s) to distributor`);
        setModal(null);
        setSelectedIds(new Set());
        setSelectedDistributorId('');
        assignmentsApi.getUsers({ page, limit: 20 }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignDistributorToRsm = () => {
    if (!selectedRsmId || selectedDistributors.length === 0) return;
    setSubmitting(true);
    const promises = selectedDistributors.map((u) =>
      userManagementApi.assignDistributorToRsm({ distributorId: u.id, rsmId: selectedRsmId })
    );
    Promise.all(promises)
      .then(() => {
        toast.success(`Assigned ${selectedDistributors.length} distributor(s) to RSM`);
        setModal(null);
        setSelectedIds(new Set());
        setSelectedRsmId('');
        assignmentsApi.getUsers({ page, limit: 20 }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignToCompany = () => {
    if (!selectedAccountId || selectedIds.size === 0) return;
    setSubmitting(true);
    userManagementApi
      .assignToAccount({ userIds: Array.from(selectedIds), accountId: selectedAccountId })
      .then(() => {
        toast.success(`Assigned ${selectedIds.size} user(s) to company`);
        setModal(null);
        setSelectedIds(new Set());
        setSelectedAccountId('');
        assignmentsApi.getUsers({ page, limit: 20 }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (userId === user?.id) {
      toast.error('You cannot change your own role');
      return;
    }
    setRoleUpdatingId(userId);
    userManagementApi
      .updateUserRole(userId, newRole)
      .then(() => {
        toast.success('Role updated');
        assignmentsApi.getUsers({ page, limit: 20, search: search || undefined }).then((r) => {
          const d = r.data as { users: UserRow[] };
          setUsers(d.users || []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to update role'))
      .finally(() => setRoleUpdatingId(null));
  };

  const handleAssignCatalogs = (catalogIds: string[], primaryCatalogId?: string) => {
    if (catalogIds.length === 0) {
      toast.error('Select at least one project book');
      return;
    }
    setSubmitting(true);
    assignmentsApi.assignCatalogs({
      userIds: Array.from(selectedIds),
      catalogIds,
      primaryCatalogId: primaryCatalogId || catalogIds[0],
    }).then(() => {
      toast.success('Project books assigned');
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
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => navigate(-1)} className="text-green-600 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-2xl font-bold">User & Project Book Assignments</h1>
        </div>
        <p className="text-sm text-gray-600">
          Select users with the checkboxes, then use Assign Project Books, Assign Price Contracts, Assign to company, Assign to distributor, or Assign to RSM (Admin only).
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
            <button onClick={() => setModal('catalogs')} className="btn bg-gray-200">Assign Project Books</button>
            <button onClick={() => setModal('contracts')} className="btn bg-gray-200">Assign Price Contracts</button>
            <button
              onClick={() => { setModal('company'); setSelectedAccountId(''); }}
              className="btn bg-amber-100 text-amber-800 flex items-center gap-1"
            >
              <Building className="w-4 h-4" />
              Assign to company
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn bg-gray-100 text-gray-600">Clear</button>
          </div>
        )}
        {/* Always visible: Assign to distributor / Assign to RSM (disabled until valid selection) */}
        {(canAssignToDistributor || canAssignDistributorToRsm) && (
          <div className="flex flex-wrap items-center gap-2">
            {canAssignToDistributor && (
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size > 0 && selectedCustomers.length > 0) {
                    setModal('distributor');
                    setSelectedDistributorId('');
                  } else {
                    toast(selectedIds.size === 0 ? 'Select one or more users in the table first' : 'Selected users must include at least one customer (not Admin/RSM)');
                  }
                }}
                disabled={selectedIds.size === 0 || selectedCustomers.length === 0}
                title={selectedIds.size === 0 ? 'Select users in the table first' : selectedCustomers.length === 0 ? 'Selected users must include at least one customer (not Admin/RSM)' : 'Assign selected customers to a distributor'}
                className={`btn flex items-center gap-1 ${selectedIds.size > 0 && selectedCustomers.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}
              >
                <Building2 className="w-4 h-4" />
                Assign to distributor
              </button>
            )}
            {canAssignDistributorToRsm && (
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size > 0 && selectedDistributors.length > 0) {
                    setModal('rsm');
                    setSelectedRsmId('');
                  } else {
                    toast(selectedIds.size === 0 ? 'Select one or more users in the table first' : 'Selected users must include at least one distributor');
                  }
                }}
                disabled={selectedIds.size === 0 || selectedDistributors.length === 0}
                title={selectedIds.size === 0 ? 'Select users in the table first' : selectedDistributors.length === 0 ? 'Selected users must include at least one distributor' : 'Assign selected distributors to an RSM'}
                className={`btn flex items-center gap-1 ${selectedIds.size > 0 && selectedDistributors.length > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}
              >
                <UserCog className="w-4 h-4" />
                Assign to RSM
              </button>
            )}
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
              <th className="px-4 py-2 text-left" title={isAdmin ? 'Admins can change role via dropdown' : ''}>
                Role{isAdmin ? ' (editable)' : ''}
              </th>
              <th className="px-4 py-2 text-left">Primary Project Book</th>
              <th className="px-4 py-2 text-left">Assigned Project Books</th>
              <th className="px-4 py-2 text-left">Price Contracts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users in your scope.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-2 font-medium">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}</td>
                  <td className="px-4 py-2">
                    {isAdmin && u.id !== user?.id ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={roleUpdatingId === u.id}
                        className="rounded border border-gray-300 px-2 py-1 text-sm bg-white min-w-[140px]"
                        title="Change user role (Admin only)"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{u.role}</span>
                    )}
                    {roleUpdatingId === u.id && <span className="ml-1 text-xs text-gray-500">Updating...</span>}
                  </td>
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
      {modal === 'distributor' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Assign to distributor
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign {selectedCustomers.length} selected user(s) to a distributor.
            </p>
            <select
              value={selectedDistributorId}
              onChange={(e) => setSelectedDistributorId(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select distributor...</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.firstName, d.lastName].filter(Boolean).join(' ') || d.email || d.id}
                  {d.email ? ` (${d.email})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setModal(null); setSelectedDistributorId(''); }} className="btn bg-gray-200">Cancel</button>
              <button onClick={handleAssignToDistributor} disabled={!selectedDistributorId || submitting} className="btn btn-primary">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'rsm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-indigo-600" />
              Assign distributor(s) to RSM
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign {selectedDistributors.length} selected distributor(s) to an RSM.
            </p>
            <select
              value={selectedRsmId}
              onChange={(e) => setSelectedRsmId(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select RSM...</option>
              {rsms.map((r) => (
                <option key={r.id} value={r.id}>
                  {[r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || r.id}
                  {r.email ? ` (${r.email})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setModal(null); setSelectedRsmId(''); }} className="btn bg-gray-200">Cancel</button>
              <button onClick={handleAssignDistributorToRsm} disabled={!selectedRsmId || submitting} className="btn btn-primary">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'company' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              Assign to company
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign {selectedIds.size} selected user(s) to the same company.
            </p>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select company...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setModal(null); setSelectedAccountId(''); }} className="btn bg-gray-200">Cancel</button>
              <button onClick={handleAssignToCompany} disabled={!selectedAccountId || submitting} className="btn btn-primary">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
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
