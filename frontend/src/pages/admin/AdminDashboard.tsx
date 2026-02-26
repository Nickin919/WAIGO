import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, Video, FolderKanban, Upload, BookOpen, Film, Image } from 'lucide-react';
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => navigate('/accounts')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Users className="w-5 h-5" />
            <span>Accounts</span>
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
            <span>Product Import</span>
          </button>
          <button
            onClick={() => navigate('/admin/import-cross-references')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Upload className="w-5 h-5" />
            <span>Cross Reference Import</span>
          </button>
          <button
            onClick={() => navigate('/admin/data-management')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <FolderKanban className="w-5 h-5" />
            <span>Reference Data</span>
          </button>
          <button
            onClick={() => navigate('/admin/literature')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <BookOpen className="w-5 h-5" />
            <span>Literature Library</span>
          </button>
          <button
            onClick={() => navigate('/admin/video-library')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Film className="w-5 h-5" />
            <span>Video Library</span>
          </button>
          <button
            onClick={() => navigate('/admin/quote-banners')}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <Image className="w-5 h-5" />
            <span>Quote PDF Assets</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
