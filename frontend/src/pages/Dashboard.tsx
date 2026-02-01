import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle, PlayCircle, DollarSign } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { catalogApi } from '@/lib/api';

const Dashboard = () => {
  const { user } = useAuthStore();
  const [catalog, setCatalog] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user?.catalogId) {
        try {
          const [catalogRes, statsRes] = await Promise.all([
            catalogApi.getById(user.catalogId),
            catalogApi.getStats(user.catalogId),
          ]);
          setCatalog(catalogRes.data);
          setStats(statsRes.data);
        } catch (error) {
          console.error('Failed to load dashboard data:', error);
        }
      }
    };

    loadData();
  }, [user?.catalogId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="text-gray-600">
          {catalog?.name || 'Your catalog'} • {stats?.partsCount || 248} parts available
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-gradient-to-br from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg">
          <div className="text-3xl font-bold mb-1">{stats?.partsCount || 248}</div>
          <div className="text-sm opacity-90">Total Parts</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg">
          <div className="text-3xl font-bold mb-1">12</div>
          <div className="text-sm opacity-90">Projects</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg">
          <div className="text-3xl font-bold mb-1">{stats?.videosCount || 45}</div>
          <div className="text-sm opacity-90">Videos</div>
        </div>
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white p-6 rounded-xl shadow-lg">
          <div className="text-3xl font-bold mb-1">23</div>
          <div className="text-sm opacity-90">Quotes</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/projects"
                className="flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">New Project</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                to="/quotes"
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">Create Quote</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">Upload BOM</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button className="text-sm text-green-600 font-medium hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Project Updated</p>
                  <p className="text-sm text-gray-600">Control Panel Upgrade • 2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">New Video Approved</p>
                  <p className="text-sm text-gray-600">Terminal Block Installation • Yesterday</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Quote Sent</p>
                  <p className="text-sm text-gray-600">PP#000123 • 2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Activity (TurnKey Users) */}
      {user?.role === 'TURNKEY' && user?.turnkeyTeamId && (
        <div className="mt-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Team Activity</h3>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                TurnKey Team
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">S</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">Sarah</span> updated{' '}
                    <span className="text-green-600">Control Panel Project</span>
                  </p>
                  <p className="text-xs text-gray-500">30 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">M</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">Mike</span> created new{' '}
                    <span className="text-green-600">cost table</span>
                  </p>
                  <p className="text-xs text-gray-500">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
