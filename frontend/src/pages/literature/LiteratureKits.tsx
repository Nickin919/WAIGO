import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Plus, BookOpen, ChevronRight, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { literatureKitApi } from '@/lib/api';

interface KitSummary {
  id: string;
  name: string;
  notes?: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LiteratureKits() {
  const navigate = useNavigate();
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKitName, setNewKitName] = useState('');
  const [newKitNotes, setNewKitNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KitSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadKits = async () => {
    setLoading(true);
    try {
      const { data } = await literatureKitApi.list();
      setKits(data.items as KitSummary[]);
    } catch {
      toast.error('Failed to load kits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKits(); }, []);

  const handleCreate = async () => {
    if (!newKitName.trim()) { toast.error('Kit name is required'); return; }
    setCreating(true);
    try {
      const { data: kit } = await literatureKitApi.create({ name: newKitName.trim(), notes: newKitNotes.trim() || undefined });
      toast.success(`Kit "${kit.name}" created`);
      setShowCreateModal(false);
      setNewKitName(''); setNewKitNotes('');
      navigate(`/literature/kits/${kit.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create kit');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await literatureKitApi.delete(deleteTarget.id);
      toast.success(`Kit "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      loadKits();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete kit');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container-custom py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BookMarked className="w-8 h-8 text-green-600" />
            My Literature Kits
          </h1>
          <p className="text-gray-500 mt-1">Saved collections of WAGO literature documents.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/literature')}
            className="btn bg-gray-100 flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> Browse Library
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Kit
          </button>
        </div>
      </div>

      {/* Kit list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : kits.length === 0 ? (
        <div className="text-center py-20">
          <BookMarked className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No kits yet</h2>
          <p className="text-gray-500 mb-6">Browse the Literature Library to find documents, then save them as a kit.</p>
          <button onClick={() => navigate('/literature')} className="btn btn-primary flex items-center gap-2 mx-auto">
            <BookOpen className="w-4 h-4" /> Go to Literature Library
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {kits.map((kit) => (
            <div
              key={kit.id}
              className="card p-4 flex items-center justify-between hover:shadow-md cursor-pointer transition-shadow group"
              onClick={() => navigate(`/literature/kits/${kit.id}`)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <BookMarked className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-green-700 truncate">{kit.name}</div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                    <span>{kit.itemCount} document{kit.itemCount !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>Updated {formatDate(kit.updatedAt)}</span>
                    {kit.notes && <span>· <span className="italic line-clamp-1">{kit.notes}</span></span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(kit); }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete kit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Kit</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kit Name *</label>
                <input
                  autoFocus type="text" className="input w-full"
                  placeholder="e.g. 221 Series Literature Pack"
                  value={newKitName}
                  onChange={(e) => setNewKitName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  className="input w-full resize-none" rows={2}
                  placeholder="e.g. For Acme Corp proposal..."
                  value={newKitNotes}
                  onChange={(e) => setNewKitNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowCreateModal(false); setNewKitName(''); setNewKitNotes(''); }} className="btn bg-gray-100">
                <X className="w-4 h-4" />Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !newKitName.trim()} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
                {creating ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Create Kit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Kit</h2>
            <p className="text-gray-600 mb-4">
              Delete <strong>"{deleteTarget.name}"</strong>? This only removes the kit — the documents themselves are not deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn bg-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2 disabled:opacity-60">
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
