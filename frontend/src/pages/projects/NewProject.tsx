import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectApi } from '@/lib/api';

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await projectApi.create({ name: name.trim(), description: description.trim() || undefined });
      toast.success('Project created');
      navigate(`/projects/${data.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container-custom py-6">
      <Link to="/projects" className="text-green-600 hover:underline flex items-center gap-1 mb-6">
        <ArrowLeft className="w-5 h-5" /> Back to Projects
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">New Project</h1>
      <p className="text-gray-600 mb-6">Give your project a name. You can upload a BOM or add parts next.</p>

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
