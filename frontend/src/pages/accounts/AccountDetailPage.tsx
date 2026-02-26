import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCog, Building2, Building, FolderKanban, Calculator, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  assignmentsApi,
  catalogApi,
  priceContractApi,
  userManagementApi,
  accountsApi,
} from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';

interface AssignmentUser {
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

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'FREE', label: 'Free / Guest' },
  { value: 'BASIC_USER', label: 'Basic User' },
  { value: 'DIRECT_USER', label: 'Direct User' },
  { value: 'DISTRIBUTOR_REP', label: 'Distributor' },
  { value: 'RSM', label: 'RSM' },
  { value: 'ADMIN', label: 'Admin' },
];

const AccountDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [account, setAccount] = useState<AssignmentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [distributors, setDistributors] = useState<TreeUser[]>([]);
  const [rsms, setRsms] = useState<TreeUser[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [modal, setModal] = useState<'distributor' | 'rsm' | 'company' | 'catalogs' | 'contracts' | null>(null);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [selectedRsmId, setSelectedRsmId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<'DISTRIBUTOR' | 'CUSTOMER'>('CUSTOMER');

  const effRole = effectiveRole(currentUser?.role ?? '');
  const canManage = currentUser?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effRole);
  const isAdmin = effRole === 'ADMIN';
  const canAssignToDistributor = isAdmin || effRole === 'RSM';
  const canAssignDistributorToRsm = isAdmin;
  const isDistributor = (u: AssignmentUser) => ['DISTRIBUTOR', 'DISTRIBUTOR_REP'].includes(effectiveRole(u.role));

  const loadUser = () => {
    if (!userId || !canManage) return;
    setLoading(true);
    assignmentsApi
      .getAssignmentUser(userId)
      .then((res) => setAccount(res.data as AssignmentUser))
      .catch(() => {
        toast.error('Failed to load account');
        setAccount(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUser();
  }, [userId, canManage]);

  useEffect(() => {
    if (!canAssignToDistributor && !canAssignDistributorToRsm) return;
    assignmentsApi.getTree().then((res) => {
      const data = res.data as { rsms?: TreeUser[]; distributors?: TreeUser[] };
      setDistributors(data.distributors ?? []);
      setRsms(data.rsms ?? []);
    }).catch(() => { setDistributors([]); setRsms([]); });
  }, [canAssignToDistributor, canAssignDistributorToRsm]);

  useEffect(() => {
    if (modal === 'company') {
      accountsApi.getList().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setAccounts(list);
        if (account?.account?.id) setSelectedAccountId(account.account.id);
      }).catch(() => setAccounts([]));
    }
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
  }, [modal, account?.account?.id]);

  const handleRoleChange = (newRole: string) => {
    if (!userId || userId === currentUser?.id) {
      toast.error('You cannot change your own role');
      return;
    }
    setSubmitting(true);
    userManagementApi
      .updateUserRole(userId, newRole)
      .then(() => {
        toast.success('Role updated');
        loadUser();
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignToDistributor = () => {
    if (!userId || !selectedDistributorId) return;
    setSubmitting(true);
    userManagementApi
      .assignToDistributor({ userId, distributorId: selectedDistributorId })
      .then(() => {
        toast.success('Assigned to distributor');
        setModal(null);
        loadUser();
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignToRsm = () => {
    if (!userId || !selectedRsmId) return;
    setSubmitting(true);
    userManagementApi
      .assignDistributorToRsm({ distributorId: userId, rsmId: selectedRsmId })
      .then(() => {
        toast.success('Assigned to RSM');
        setModal(null);
        loadUser();
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignToCompany = () => {
    if (!userId) return;
    const accountId = newCompanyName.trim() ? null : (selectedAccountId || null);
    if (!accountId && !newCompanyName.trim()) {
      toast.error('Select a company or create a new one');
      return;
    }
    setSubmitting(true);
    const doAssign = (id: string | null) => userManagementApi.assignToAccount({ userId, accountId: id });
    if (newCompanyName.trim()) {
      accountsApi
        .create({ name: newCompanyName.trim(), type: newCompanyType })
        .then((res) => {
          const created = (res.data as { id: string }).id;
          return doAssign(created);
        })
        .then(() => {
          toast.success('Company created and user assigned');
          setModal(null);
          setNewCompanyName('');
          loadUser();
        })
        .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
        .finally(() => setSubmitting(false));
    } else {
      doAssign(accountId)
        .then(() => {
          toast.success('User assigned to company');
          setModal(null);
          loadUser();
        })
        .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
        .finally(() => setSubmitting(false));
    }
  };

  const handleAssignCatalogs = (catalogIds: string[], primaryCatalogId?: string) => {
    if (!userId) return;
    setSubmitting(true);
    assignmentsApi
      .assignCatalogs({ userId, catalogIds, primaryCatalogId: primaryCatalogId || catalogIds[0] })
      .then(() => {
        toast.success('Project books assigned');
        setModal(null);
        loadUser();
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  const handleAssignContracts = (contractIds: string[]) => {
    if (!userId) return;
    if (!contractIds?.length) {
      toast.error('Select at least one price contract.');
      return;
    }
    setSubmitting(true);
    assignmentsApi
      .assignContracts({ userId, contractIds })
      .then(() => {
        toast.success('Price contracts assigned');
        setModal(null);
        loadUser();
      })
      .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to accounts.</p>
        <Link to="/accounts" className="mt-4 inline-block text-green-600 hover:underline">Back to Accounts</Link>
      </div>
    );
  }

  if (loading || !account) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/accounts" className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Back to Accounts
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName(account)}</h1>
      <p className="text-gray-600 mb-6">{account.email || '—'}</p>

      <div className="space-y-6">
        {/* Role */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <UserCog className="w-5 h-5" /> Role
          </h2>
          {isAdmin && account.id !== currentUser?.id ? (
            <select
              value={account.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={submitting}
              className="rounded border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-gray-700">{account.role}</p>
          )}
        </section>

        {/* Hierarchy */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5" /> Hierarchy
          </h2>
          <div className="space-y-2">
            {!['ADMIN', 'RSM'].includes(effectiveRole(account.role)) && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Distributor:</span>
                <span className="font-medium">{account.assignedToDistributor ? (account.assignedToDistributor.companyName || account.assignedToDistributor.email || displayName(account.assignedToDistributor)) : '—'}</span>
                {canAssignToDistributor && (
                  <button type="button" onClick={() => { setModal('distributor'); setSelectedDistributorId(account.assignedToDistributor?.id ?? ''); }} className="btn btn-outline text-sm ml-2">
                    {account.assignedToDistributor ? 'Change' : 'Assign'}
                  </button>
                )}
              </div>
            )}
            {['DISTRIBUTOR', 'DISTRIBUTOR_REP'].includes(effectiveRole(account.role)) && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">RSM:</span>
                <span className="font-medium">{account.assignedToRsm ? displayName(account.assignedToRsm) : '—'}</span>
                {canAssignDistributorToRsm && (
                  <button type="button" onClick={() => { setModal('rsm'); setSelectedRsmId(account.assignedToRsm?.id ?? ''); }} className="btn btn-outline text-sm ml-2">
                    {account.assignedToRsm ? 'Change' : 'Assign'}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Company */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Building className="w-5 h-5" /> Company
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">{account.account?.name ?? '—'}</span>
            <button type="button" onClick={() => { setModal('company'); setSelectedAccountId(account.account?.id ?? ''); setNewCompanyName(''); setNewCompanyType(isDistributor(account) ? 'DISTRIBUTOR' : 'CUSTOMER'); }} className="btn btn-outline text-sm">
              {account.account ? 'Change' : 'Assign'}
            </button>
          </div>
        </section>

        {/* Project Books */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FolderKanban className="w-5 h-5" /> Project Books
          </h2>
          <p className="text-sm text-gray-600 mb-2">Primary: {account.primaryCatalog?.name ?? '—'}</p>
          <p className="text-sm text-gray-600 mb-2">Assigned: {(account.assignedCatalogs || []).map((c) => c.name).join(', ') || '—'}</p>
          <button type="button" onClick={() => setModal('catalogs')} className="btn btn-outline text-sm">Edit project books</button>
        </section>

        {/* Price contracts */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5" /> Price contracts
          </h2>
          <p className="text-sm text-gray-600 mb-2">{(account.assignedContracts || []).map((c) => c.name).join(', ') || '—'}</p>
          <button type="button" onClick={() => setModal('contracts')} className="btn btn-outline text-sm">Edit contracts</button>
        </section>
      </div>

      {/* Modals */}
      {modal === 'distributor' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assign to distributor</h3>
              <button type="button" onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <select value={selectedDistributorId} onChange={(e) => setSelectedDistributorId(e.target.value)} className="input w-full mb-4">
              <option value="">Select distributor...</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>{displayName(d)} {d.email ? `(${d.email})` : ''}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn bg-gray-200">Cancel</button>
              <button type="button" onClick={handleAssignToDistributor} disabled={!selectedDistributorId || submitting} className="btn btn-primary">{submitting ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'rsm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assign distributor to RSM</h3>
              <button type="button" onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <select value={selectedRsmId} onChange={(e) => setSelectedRsmId(e.target.value)} className="input w-full mb-4">
              <option value="">Select RSM...</option>
              {rsms.map((r) => (
                <option key={r.id} value={r.id}>{displayName(r)} {r.email ? `(${r.email})` : ''}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn bg-gray-200">Cancel</button>
              <button type="button" onClick={handleAssignToRsm} disabled={!selectedRsmId || submitting} className="btn btn-primary">{submitting ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'company' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assign to company</h3>
              <button type="button" onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {account && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Existing company</label>
                <select value={newCompanyName.trim() ? '' : selectedAccountId} onChange={(e) => { setSelectedAccountId(e.target.value); setNewCompanyName(''); }} className="input w-full mb-3">
                  <option value="">— Or create new below —</option>
                  {(accounts.filter((a) => a.type === (isDistributor(account) ? 'DISTRIBUTOR' : 'CUSTOMER'))).map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
                <label className="block text-sm font-medium text-gray-700 mb-1">Or create new company</label>
                <input type="text" placeholder="Company name" value={newCompanyName} onChange={(e) => { setNewCompanyName(e.target.value); if (e.target.value.trim()) setSelectedAccountId(''); }} className="input w-full mb-4" />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setModal(null)} className="btn bg-gray-200">Cancel</button>
                  <button type="button" onClick={handleAssignToCompany} disabled={(!selectedAccountId && !newCompanyName.trim()) || submitting} className="btn btn-primary">{submitting ? 'Assigning...' : 'Assign'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {modal === 'catalogs' && (
        <CatalogModal catalogs={catalogs} currentPrimaryId={account.primaryCatalog?.id} currentCatalogIds={account.assignedCatalogs?.map((c) => c.id) ?? []} onAssign={handleAssignCatalogs} onClose={() => setModal(null)} submitting={submitting} />
      )}

      {modal === 'contracts' && (
        <ContractModal contracts={contracts} currentContractIds={account.assignedContracts?.map((c) => c.id) ?? []} onAssign={handleAssignContracts} onClose={() => setModal(null)} submitting={submitting} />
      )}
    </div>
  );
};

function CatalogModal({
  catalogs,
  currentPrimaryId,
  currentCatalogIds,
  onAssign,
  onClose,
  submitting,
}: {
  catalogs: { id: string; name: string }[];
  currentPrimaryId?: string;
  currentCatalogIds: string[];
  onAssign: (catalogIds: string[], primaryCatalogId?: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCatalogIds));
  const [primaryId, setPrimaryId] = useState<string>(currentPrimaryId || currentCatalogIds[0] || '');

  useEffect(() => {
    setSelected(new Set(currentCatalogIds));
    setPrimaryId(currentPrimaryId || currentCatalogIds[0] || '');
  }, [currentPrimaryId, currentCatalogIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Project Books</h3>
        <p className="text-sm text-gray-600 mb-4">Select project books to assign. One will be set as primary. The Master Catalog is assigned to all users by default.</p>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {catalogs.map((c) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
              <input type="radio" name="primaryCat" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} disabled={!selected.has(c.id)} className="rounded" title="Primary" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn bg-gray-200">Cancel</button>
          <button type="button" onClick={() => onAssign(Array.from(selected), primaryId || undefined)} disabled={submitting || selected.size === 0} className="btn btn-primary">{submitting ? 'Assigning...' : 'Assign'}</button>
        </div>
      </div>
    </div>
  );
}

function ContractModal({
  contracts,
  currentContractIds,
  onAssign,
  onClose,
  submitting,
}: {
  contracts: { id: string; name: string }[];
  currentContractIds: string[];
  onAssign: (contractIds: string[]) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentContractIds));

  useEffect(() => {
    setSelected(new Set(currentContractIds));
  }, [currentContractIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Price Contracts</h3>
        <p className="text-sm text-gray-600 mb-4">Select price contracts for this user.</p>
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
          <button type="button" onClick={() => onAssign(Array.from(selected))} disabled={submitting || selected.size === 0} className="btn btn-primary">{submitting ? 'Assigning...' : 'Assign'}</button>
        </div>
      </div>
    </div>
  );
}

export default AccountDetailPage;
