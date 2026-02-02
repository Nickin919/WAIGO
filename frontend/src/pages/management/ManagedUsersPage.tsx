import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, Building2, UserCog, X, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { userManagementApi, assignmentsApi, accountsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  role: string;
  isActive: boolean;
  accountId?: string | null;
  account?: { id: string; name: string; type: string } | null;
  assignedToDistributor?: { id: string; email: string | null; companyName: string | null } | null;
  assignedToRsm?: { id: string; email: string | null; firstName?: string | null; lastName?: string | null } | null;
  createdAt: string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  userCount?: number;
}

interface TreeUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role?: string;
}

const ManagedUsersPage = () => {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [distributors, setDistributors] = useState<TreeUser[]>([]);
  const [rsms, setRsms] = useState<TreeUser[]>([]);
  const [assignDistributorFor, setAssignDistributorFor] = useState<User | null>(null);
  const [assignRsmFor, setAssignRsmFor] = useState<User | null>(null);
  const [assignCompanyFor, setAssignCompanyFor] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [selectedRsmId, setSelectedRsmId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<'DISTRIBUTOR' | 'CUSTOMER'>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);

  const effRole = effectiveRole(user?.role ?? '');
  const canManage = user?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effRole);
  const canAssignToDistributor = effRole === 'ADMIN' || effRole === 'RSM';
  const canAssignDistributorToRsm = effRole === 'ADMIN';
  const canAssignToCompany = canManage;

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    userManagementApi
      .getUsers({ search: search || undefined })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setUsers(data);
      })
      .catch(() => {
        toast.error('Failed to load users');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [canManage, search]);

  useEffect(() => {
    if (!canAssignToDistributor && !canAssignDistributorToRsm) return;
    assignmentsApi
      .getTree()
      .then((res) => {
        const data = res.data as { rsms?: TreeUser[]; distributors?: TreeUser[] };
        setDistributors(data.distributors ?? []);
        setRsms(data.rsms ?? []);
      })
      .catch(() => {
        setDistributors([]);
        setRsms([]);
      });
  }, [canAssignToDistributor, canAssignDistributorToRsm]);

  useEffect(() => {
    if (!assignCompanyFor || !canAssignToCompany) return;
    setNewCompanyName('');
    setNewCompanyType(isDistributor(assignCompanyFor) ? 'DISTRIBUTOR' : 'CUSTOMER');
    accountsApi
      .getList()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setAccounts(list);
        setSelectedAccountId(assignCompanyFor.accountId ?? '');
      })
      .catch(() => setAccounts([]));
  }, [assignCompanyFor, canAssignToCompany]);

  const displayName = (u: User | TreeUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—';

  const isDistributor = (u: User) =>
    ['DISTRIBUTOR', 'DISTRIBUTOR_REP'].includes(effectiveRole(u.role));
  const isCustomerOrAny = (u: User) =>
    !['ADMIN', 'RSM'].includes(effectiveRole(u.role));

  const handleAssignToDistributor = () => {
    if (!assignDistributorFor || !selectedDistributorId) return;
    setSubmitting(true);
    userManagementApi
      .assignToDistributor({ userId: assignDistributorFor.id, distributorId: selectedDistributorId })
      .then(() => {
        toast.success('User assigned to distributor');
        setAssignDistributorFor(null);
        setSelectedDistributorId('');
        userManagementApi.getUsers({ search: search || undefined }).then((res) => {
          setUsers(Array.isArray(res.data) ? res.data : []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignDistributorToRsm = () => {
    if (!assignRsmFor || !selectedRsmId) return;
    setSubmitting(true);
    userManagementApi
      .assignDistributorToRsm({ distributorId: assignRsmFor.id, rsmId: selectedRsmId })
      .then(() => {
        toast.success('Distributor assigned to RSM');
        setAssignRsmFor(null);
        setSelectedRsmId('');
        userManagementApi.getUsers({ search: search || undefined }).then((res) => {
          setUsers(Array.isArray(res.data) ? res.data : []);
        });
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to assign'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignToCompany = () => {
    if (!assignCompanyFor) return;
    const accountId = newCompanyName.trim() ? null : (selectedAccountId || null);
    if (!accountId && !newCompanyName.trim()) {
      toast.error('Select a company or create a new one');
      return;
    }
    setSubmitting(true);
    const doAssign = (id: string | null) =>
      userManagementApi.assignToAccount({ userId: assignCompanyFor.id, accountId: id });
    if (newCompanyName.trim()) {
      accountsApi
        .create({ name: newCompanyName.trim(), type: newCompanyType })
        .then((res) => {
          const created = (res.data as { id: string }).id;
          return doAssign(created);
        })
        .then(() => {
          toast.success('Company created and user assigned');
          setAssignCompanyFor(null);
          setSelectedAccountId('');
          setNewCompanyName('');
          userManagementApi.getUsers({ search: search || undefined }).then((r) => setUsers(Array.isArray(r.data) ? r.data : []));
        })
        .catch((err: any) => toast.error(err.response?.data?.error || 'Failed'))
        .finally(() => setSubmitting(false));
    } else {
      doAssign(accountId)
        .then(() => {
          toast.success('User assigned to company');
          setAssignCompanyFor(null);
          setSelectedAccountId('');
          userManagementApi.getUsers({ search: search || undefined }).then((r) => setUsers(Array.isArray(r.data) ? r.data : []));
        })
        .catch((err: any) => toast.error(err.response?.data?.error || 'Failed'))
        .finally(() => setSubmitting(false));
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to managed users.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Managed Users</h1>
          <p className="text-gray-600 mt-1">
            Users in your hierarchy. Assign users to a distributor (RSM/Admin), assign distributors to an RSM (Admin), or assign users to the same company (distributors → DISTRIBUTOR company, direct/basic → CUSTOMER company). Use Assignments for catalog and price contract assignments.
          </p>
        </div>
        <Link
          to="/assignments"
          className="btn btn-primary flex items-center gap-2 w-fit"
        >
          <UserPlus className="w-5 h-5" />
          Catalog & Contract Assignments
        </Link>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Distributor</th>
                  {canAssignDistributorToRsm && (
                    <th className="px-4 py-3 text-left font-medium text-gray-700">RSM</th>
                  )}
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{displayName(u)}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.account?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.assignedToDistributor?.companyName || u.assignedToDistributor?.email || '—'}
                    </td>
                    {canAssignDistributorToRsm && (
                      <td className="px-4 py-3 text-gray-600">
                        {u.assignedToRsm ? [u.assignedToRsm.firstName, u.assignedToRsm.lastName].filter(Boolean).join(' ') || u.assignedToRsm.email : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          to={`/assignments?userId=${u.id}`}
                          className="btn btn-outline text-sm py-1 px-2"
                        >
                          Catalog & Contracts
                        </Link>
                        {canAssignToDistributor && isCustomerOrAny(u) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignDistributorFor(u);
                              setSelectedDistributorId(u.assignedToDistributor?.id ?? '');
                            }}
                            className="btn bg-blue-50 text-blue-700 border border-blue-200 text-sm py-1 px-2 flex items-center gap-1 hover:bg-blue-100"
                          >
                            <Building2 className="w-4 h-4" />
                            {u.assignedToDistributor ? 'Change distributor' : 'Assign to distributor'}
                          </button>
                        )}
                        {canAssignDistributorToRsm && isDistributor(u) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignRsmFor(u);
                              setSelectedRsmId(u.assignedToRsm?.id ?? '');
                            }}
                            className="btn bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm py-1 px-2 flex items-center gap-1 hover:bg-indigo-100"
                          >
                            <UserCog className="w-4 h-4" />
                            {u.assignedToRsm ? 'Change RSM' : 'Assign to RSM'}
                          </button>
                        )}
                        {canAssignToCompany && isCustomerOrAny(u) && (
                          <button
                            type="button"
                            onClick={() => setAssignCompanyFor(u)}
                            className="btn bg-amber-50 text-amber-800 border border-amber-200 text-sm py-1 px-2 flex items-center gap-1 hover:bg-amber-100"
                          >
                            <Building className="w-4 h-4" />
                            {u.account ? 'Change company' : 'Assign to company'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign user to distributor modal */}
      {assignDistributorFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign to distributor</h3>
              <button type="button" onClick={() => { setAssignDistributorFor(null); setSelectedDistributorId(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Assign <strong>{displayName(assignDistributorFor)}</strong> to a distributor.
            </p>
            <select
              value={selectedDistributorId}
              onChange={(e) => setSelectedDistributorId(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select distributor...</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>{displayName(d)} {d.email ? `(${d.email})` : ''}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setAssignDistributorFor(null); setSelectedDistributorId(''); }} className="btn btn-outline">
                Cancel
              </button>
              <button type="button" onClick={handleAssignToDistributor} disabled={!selectedDistributorId || submitting} className="btn btn-primary">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign distributor to RSM modal (Admin only) */}
      {assignRsmFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign distributor to RSM</h3>
              <button type="button" onClick={() => { setAssignRsmFor(null); setSelectedRsmId(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Assign distributor <strong>{displayName(assignRsmFor)}</strong> to an RSM.
            </p>
            <select
              value={selectedRsmId}
              onChange={(e) => setSelectedRsmId(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select RSM...</option>
              {rsms.map((r) => (
                <option key={r.id} value={r.id}>{displayName(r)} {r.email ? `(${r.email})` : ''}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setAssignRsmFor(null); setSelectedRsmId(''); }} className="btn btn-outline">
                Cancel
              </button>
              <button type="button" onClick={handleAssignDistributorToRsm} disabled={!selectedRsmId || submitting} className="btn btn-primary">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to company modal */}
      {assignCompanyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign to company</h3>
              <button type="button" onClick={() => { setAssignCompanyFor(null); setSelectedAccountId(''); setNewCompanyName(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Assign <strong>{displayName(assignCompanyFor)}</strong> to a company. {isDistributor(assignCompanyFor) ? 'Distributors share a company (DISTRIBUTOR).' : 'Direct/Basic users share a company (CUSTOMER).'}
            </p>
            {(() => {
              const accountType = isDistributor(assignCompanyFor) ? 'DISTRIBUTOR' : 'CUSTOMER';
              const filteredAccounts = accounts.filter((a) => a.type === accountType);
              return (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Existing company</label>
                  <select
                    value={newCompanyName.trim() ? '' : selectedAccountId}
                    onChange={(e) => { setSelectedAccountId(e.target.value); setNewCompanyName(''); }}
                    className="input w-full mb-3"
                  >
                    <option value="">— Select or create new below —</option>
                    {filteredAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                  </select>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Or create new company</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Company name"
                      value={newCompanyName}
                      onChange={(e) => { setNewCompanyName(e.target.value); if (e.target.value.trim()) setSelectedAccountId(''); }}
                      className="input flex-1"
                    />
                    <span className="flex items-center text-sm text-gray-500">({accountType})</span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setAssignCompanyFor(null); setSelectedAccountId(''); setNewCompanyName(''); }} className="btn btn-outline">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAssignToCompany}
                      disabled={(!selectedAccountId && !newCompanyName.trim()) || submitting}
                      className="btn btn-primary"
                    >
                      {submitting ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagedUsersPage;
