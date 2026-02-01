import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Edit, Trash2, Package } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Catalog {
  id: string;
  name: string;
  description?: string;
  creatorName: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

const CatalogList = () => {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    try {
      const response = await axios.get('/api/catalog-creator/my-catalogs');
      setCatalogs(response.data);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
      toast.error('Failed to load catalogs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (catalogId: string) => {
    if (!confirm('Are you sure you want to delete this catalog?')) return;

    try {
      await axios.delete(`/api/catalog-creator/delete/${catalogId}`);
      toast.success('Catalog deleted successfully');
      loadCatalogs();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.error || 'Failed to delete catalog');
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
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Catalogs</h1>
          <p className="text-gray-600">
            Create and manage custom product catalogs
          </p>
        </div>
        <Link
          to="/catalog-creator/new"
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>New Catalog</span>
        </Link>
      </div>

      {/* Catalogs Grid */}
      {catalogs.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No catalogs yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first custom catalog to organize products
          </p>
          <Link
            to="/catalog-creator/new"
            className="btn btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Catalog</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogs.map(catalog => (
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
                  className="btn bg-red-50 text-red-600 hover:bg-red-100 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogList;
