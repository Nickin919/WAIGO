import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, Video, FolderKanban, Upload } from 'lucide-react';
import { adminApi } from '@/lib/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { data } = await adminApi.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-wago-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-10 h-10 text-wago-blue" />
            <span className="text-3xl font-bold text-gray-900">
              {stats?.users || 0}
            </span>
          </div>
          <div className="text-gray-600">Total Users</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-10 h-10 text-wago-green" />
            <span className="text-3xl font-bold text-gray-900">
              {stats?.parts || 0}
            </span>
          </div>
          <div className="text-gray-600">Total Parts</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <Video className="w-10 h-10 text-purple-600" />
            <span className="text-3xl font-bold text-gray-900">
              {stats?.pendingVideos || 0}
            </span>
          </div>
          <div className="text-gray-600">Pending Videos</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <FolderKanban className="w-10 h-10 text-orange-600" />
            <span className="text-3xl font-bold text-gray-900">
              {stats?.projects || 0}
            </span>
          </div>
          <div className="text-gray-600">Total Projects</div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/managed-users')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Users className="w-5 h-5" />
            <span>Manage Users</span>
          </button>
          <button
            onClick={() => navigate('/videos')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Video className="w-5 h-5" />
            <span>Review Videos</span>
          </button>
          <button
            onClick={() => navigate('/catalog-list')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <FolderKanban className="w-5 h-5" />
            <span>Manage Catalogs</span>
          </button>
          <button
            onClick={() => navigate('/admin/import-products')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Upload className="w-5 h-5" />
            <span>Import Products</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
