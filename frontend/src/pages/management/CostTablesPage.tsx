import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Download, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { costTableApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface CostTable {
  id: string;
  name: string;
  description: string | null;
  userId: string | null;
  turnkeyTeamId: string | null;
  user?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  turnkeyTeam?: { name: string } | null;
  _count?: { items: number };
}

const CostTablesPage = () => {
  const { user } = useAuthStore();
  const [tables, setTables] = useState<CostTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const canManage = user?.role && ['TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'].includes(user.role);

  const loadTables = () => {
    if (!canManage) return;
    setLoading(true);
    costTableApi
      .getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setTables(data);
      })
      .catch(() => {
        toast.error('Failed to load cost tables');
        setTables([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTables();
  }, [canManage]);

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    setCreating(true);
    costTableApi
      .create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      })
      .then(() => {
        toast.success('Cost table created');
        setShowCreate(false);
        setNewName('');
        setNewDesc('');
        loadTables();
      })
      .catch((err: any) => toast.error(err.response?.data?.error || 'Failed to create'))
      .finally(() => setCreating(false));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete cost table "${name}"?`)) return;
    try {
      await costTableApi.delete(id);
      toast.success('Cost table deleted');
      loadTables();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleDownload = (id: string, name: string) => {
    costTableApi
      .downloadCsv(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cost-table-${name.replace(/\s+/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started');
      })
      .catch(() => toast.error('Download failed'));
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to cost tables.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Tables</h1>
          <p className="text-gray-600 mt-1">
            Custom cost tables for quotes and projects.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          New Cost Table
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6">
          <h3 className="font-bold mb-4">Create Cost Table</h3>
          <div className="space-y-3 max-w-md">
            <input
              type="text"
              placeholder="Name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input w-full"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input w-full"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No cost tables yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary mt-4"
            >
              Create your first cost table
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tables.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.turnkeyTeam?.name ||
                        (t.user ? [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || t.user.email : '—')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t._count?.items ?? 0}</td>
                    <td className="px-4 py-3 text-right flex gap-2 justify-end">
                      <button
                        onClick={() => handleDownload(t.id, t.name)}
                        className="text-green-600 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" /> CSV
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostTablesPage;
