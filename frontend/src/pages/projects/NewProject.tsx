import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateProjectMutation } from '@/hooks/useProjectQueries';
import api, { publicApi } from '@/lib/api';

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const createMutation = useCreateProjectMutation();

  useEffect(() => {
    api.get('/assignments/me')
      .then((res) => {
        const data = res.data as { catalogs?: { id: string; name: string }[] };
        const list = data.catalogs || [];
        setCatalogs(list.map((c) => ({ id: c.id, name: c.name || 'Unnamed' })));
        if (list.length > 0) setCatalogId((prev) => prev || list[0].id);
      })
      .catch(() => {
        publicApi.getCatalogs()
          .then((res) => {
            const list = Array.isArray(res.data) ? res.data : [];
            setCatalogs(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name || 'Unnamed' })));
            if (list.length > 0) setCatalogId((prev) => prev || list[0].id);
          })
          .catch(() => {});
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    try {
      const data = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        catalogId: catalogId || undefined,
      });
      toast.success('Project created');
      navigate(`/projects/${data.id}`, { replace: true });
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to create project';
      toast.error(msg || 'Failed to create project');
    }
  };

  const creating = createMutation.isPending;

  return (
    <div className="container-custom py-6">
      <Link to="/projects" className="text-green-600 hover:underline flex items-center gap-1 mb-6">
        <ArrowLeft className="w-5 h-5" /> Back to Projects
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">New Project</h1>
      <p className="text-gray-600 mb-6">Give your project a name and choose a catalog for finding parts. You can upload a BOM or add parts next.</p>

      <form onSubmit={handleSubmit} className="card p-6 max-w-md">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Project name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="e.g., Control Panel Upgrade"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Catalog</label>
          <select
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            className="input w-full"
          >
            <option value="">Select a catalog (recommended)</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Parts you add will be searched in this catalog. If none is selected, your assigned or default catalog is used.</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input w-full min-h-[100px] resize-none"
            placeholder="Optional project description"
          />
        </div>
        <div className="flex gap-3">
          <Link to="/projects" className="btn btn-secondary flex-1">
            Cancel
          </Link>
          <button type="submit" disabled={creating} className="btn btn-primary flex-1">
            {creating ? 'Creating...' : 'Create & Open'}
          </button>
        </div>
      </form>
    </div>
  );
}
