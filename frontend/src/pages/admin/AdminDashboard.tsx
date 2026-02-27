import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, Video, FolderKanban, Upload, BookOpen, Film, Image, AlertCircle, FileSearch, Search } from 'lucide-react';
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

      <div className="space-y-8">
        {/* Users & accounts */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Users & accounts</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/accounts')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              Accounts
            </button>
            <button
              onClick={() => navigate('/videos')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Video className="w-5 h-5" />
              Review Videos
            </button>
            <button
              onClick={() => navigate('/catalog-list')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FolderKanban className="w-5 h-5" />
              Manage Project Books
            </button>
          </div>
        </section>

        {/* Imports & reference data */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Imports & reference data</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/admin/import-products')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Product Import
            </button>
            <button
              onClick={() => navigate('/admin/import-cross-references')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Cross Reference Import
            </button>
            <button
              onClick={() => navigate('/admin/data-management')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FolderKanban className="w-5 h-5" />
              Reference Data
            </button>
          </div>
        </section>

        {/* Reports & resolution */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Reports & resolution</h2>
          <p className="text-sm text-gray-600 mb-3">Resolve failure reports and submission issues; inspect and fix product data.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/admin/product-inspection')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Product Inspection
            </button>
            <button
              onClick={() => navigate('/admin/failure-report')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              Failure Report
            </button>
            <button
              onClick={() => navigate('/admin/unmatched-submissions')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FileSearch className="w-5 h-5" />
              Unmatched Submissions
            </button>
          </div>
        </section>

        {/* Libraries & assets */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Libraries & assets</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/admin/literature')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Literature Library
            </button>
            <button
              onClick={() => navigate('/admin/video-library')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Film className="w-5 h-5" />
              Video Library
            </button>
            <button
              onClick={() => navigate('/admin/quote-banners')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Image className="w-5 h-5" />
              Quote PDF Assets
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
