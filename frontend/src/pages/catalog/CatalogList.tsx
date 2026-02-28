import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Edit, Trash2, Package, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { assignmentsApi } from '@/lib/api';

interface CreatedCatalog {
  id: string;
  name: string;
  description?: string;
  creatorName: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AssignedCatalog {
  id: string;
  name: string;
  isPrimary?: boolean;
}

const CatalogList = () => {
  const [createdCatalogs, setCreatedCatalogs] = useState<CreatedCatalog[]>([]);
  const [assignedCatalogs, setAssignedCatalogs] = useState<AssignedCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [createdRes, assignedRes] = await Promise.all([
        api.get('/catalog-creator/my-catalogs').catch(() => ({ data: [] })),
        assignmentsApi.getMyAssignments().catch(() => ({ data: {} })),
      ]);
      setCreatedCatalogs(Array.isArray(createdRes.data) ? createdRes.data : []);
      const assigned = (assignedRes.data as { catalogs?: AssignedCatalog[] })?.catalogs ?? [];
      setAssignedCatalogs(Array.isArray(assigned) ? assigned : []);
    } catch (error) {
      console.error('Failed to load project books:', error);
      toast.error('Failed to load project books');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (catalogId: string) => {
    if (!confirm('Are you sure you want to delete this project book?')) return;
    setDeletingCatalogId(catalogId);
    try {
      await api.delete(`/catalog-creator/delete/${catalogId}`);
      toast.success('Project book deleted successfully');
      loadCatalogs();
    } catch (error: any) {
      console.error('Delete error:', error);
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to delete project book';
      toast.error(msg);
    } finally {
      setDeletingCatalogId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Project Books</h1>
          <p className="text-gray-600">
            Browse project books assigned to you or create and manage custom project books
          </p>
        </div>
        <Link
          to="/catalog-creator/new"
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>New Project Book</span>
        </Link>
      </div>

      {/* Assigned to you */}
      {assignedCatalogs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned to you</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedCatalogs.map((c) => (
              <Link
                key={c.id}
                to={`/catalog?catalogId=${encodeURIComponent(c.id)}`}
                className="card p-4 hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-900 truncate">{c.name}</span>
                  {c.isPrimary && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex-shrink-0">Primary</span>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Project Books you created */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Project Books you created</h2>
        {createdCatalogs.length === 0 ? (
          <div className="card p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom project books yet</h3>
            <p className="text-gray-600 mb-6">
              Create a custom project book to organize products from the Master Catalog
            </p>
            <Link
              to="/catalog-creator/new"
              className="btn btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Project Book</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {createdCatalogs.map((catalog) => (
              <div key={catalog.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{catalog.name}</h3>
                      <p className="text-xs text-gray-500">by {catalog.creatorName}</p>
                    </div>
                  </div>
                </div>

                {catalog.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {catalog.description}
                  </p>
                )}

                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <Package className="w-4 h-4 mr-1" />
                  <span>{catalog.itemCount} products</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    to={`/catalog-creator/${catalog.id}`}
                    className="btn btn-secondary flex-1 text-sm"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(catalog.id)}
                    disabled={deletingCatalogId === catalog.id}
                    className="btn bg-red-50 text-red-600 hover:bg-red-100 text-sm disabled:opacity-60"
                  >
                    {deletingCatalogId === catalog.id ? (
                      <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CatalogList;
