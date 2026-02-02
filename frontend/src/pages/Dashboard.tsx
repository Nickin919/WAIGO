import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle, DollarSign, Package, FolderKanban, Video, FileText, Library } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';
import { catalogApi, projectApi, quoteApi } from '@/lib/api';

interface CatalogStats {
  partsCount: number;
  categoriesCount?: number;
  videosCount: number;
}

const Dashboard = () => {
  const { user } = useAuthStore();
  const [catalog, setCatalog] = useState<{ name?: string } | null>(null);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [quotesCount, setQuotesCount] = useState<number | null>(null);
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<{ id: string; quoteNumber?: string; createdAt: string }[]>([]);
  const [catalogSummary, setCatalogSummary] = useState<{ catalogCount: number; averagePartsPerCatalog: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const promises: Promise<unknown>[] = [];
        const catalogId = user.catalogId;

        if (catalogId) {
          promises.push(
            catalogApi.getById(catalogId).then((r) => {
              setCatalog(r.data);
              return r.data;
            }),
            catalogApi.getStats(catalogId).then((r) => {
              setStats(r.data);
              return r.data;
            })
          );
        }

        promises.push(
          projectApi.getAll().then((r) => {
            const list = Array.isArray(r.data) ? r.data : [];
            setProjectsCount(list.length);
            setRecentProjects(
              list
                .slice(0, 3)
                .map((p: { id: string; name: string; updatedAt: string }) => ({
                  id: p.id,
                  name: p.name,
                  updatedAt: p.updatedAt,
                }))
            );
            return list;
          })
        );
        promises.push(
          quoteApi.getAll().then((r) => {
            const list = Array.isArray(r.data) ? r.data : [];
            setQuotesCount(list.length);
            setRecentQuotes(
              list
                .slice(0, 3)
                .map((q: { id: string; quoteNumber?: string; createdAt: string }) => ({
                  id: q.id,
                  quoteNumber: q.quoteNumber,
                  createdAt: q.createdAt,
                }))
            );
            return list;
          })
        );
        promises.push(
          catalogApi.getMySummary().then((r) => {
            const data = r.data as { catalogCount: number; averagePartsPerCatalog: number };
            setCatalogSummary(data);
            return data;
          }).catch(() => {
            setCatalogSummary(null);
            return null;
          })
        );

        await Promise.all(promises);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, user?.catalogId]);

  const partsLabel = stats?.partsCount != null ? stats.partsCount : '—';
  const videosLabel = stats?.videosCount != null ? stats.videosCount : '—';
  const projectsLabel = projectsCount != null ? projectsCount : (loading ? '…' : 0);
  const quotesLabel = quotesCount != null ? quotesCount : (loading ? '…' : 0);
  const catalogCountLabel = catalogSummary != null ? catalogSummary.catalogCount : (loading ? '…' : 0);
  const averagePartsPerCatalog = catalogSummary?.averagePartsPerCatalog ?? null;

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="text-gray-600">
          {catalog?.name || 'Your catalog'}
          {stats?.partsCount != null && ` • ${stats.partsCount} parts available`}
        </p>
      </div>

      {/* Stats Cards – wired to real data, link to relevant pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
        <Link
          to="/catalog-list"
          className="bg-gradient-to-br from-cyan-600 to-cyan-700 text-white p-6 rounded-xl shadow-lg hover:from-cyan-700 hover:to-cyan-800 transition-all block"
        >
          <div className="flex items-center gap-2 mb-1">
            <Library className="w-6 h-6 opacity-90" />
            <span className="text-3xl font-bold">{catalogCountLabel}</span>
          </div>
          <div className="text-sm opacity-90">Catalogs</div>
          {averagePartsPerCatalog != null && (
            <div className="text-xs opacity-80 mt-1">Avg {averagePartsPerCatalog.toLocaleString()} parts/catalog</div>
          )}
        </Link>
        <Link
          to={user?.catalogId ? '/catalog' : '/catalog-list'}
          className="bg-gradient-to-br from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg hover:from-green-700 hover:to-green-800 transition-all block"
        >
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-6 h-6 opacity-90" />
            <span className="text-3xl font-bold">{partsLabel}</span>
          </div>
          <div className="text-sm opacity-90">Total Parts</div>
        </Link>
        <Link
          to="/projects"
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all block"
        >
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="w-6 h-6 opacity-90" />
            <span className="text-3xl font-bold">{projectsLabel}</span>
          </div>
          <div className="text-sm opacity-90">Projects</div>
        </Link>
        <Link
          to="/videos"
          className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all block"
        >
          <div className="flex items-center gap-2 mb-1">
            <Video className="w-6 h-6 opacity-90" />
            <span className="text-3xl font-bold">{videosLabel}</span>
          </div>
          <div className="text-sm opacity-90">Videos</div>
        </Link>
        <Link
          to="/quotes"
          className="bg-gradient-to-br from-orange-600 to-orange-700 text-white p-6 rounded-xl shadow-lg hover:from-orange-700 hover:to-orange-800 transition-all block"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-6 h-6 opacity-90" />
            <span className="text-3xl font-bold">{quotesLabel}</span>
          </div>
          <div className="text-sm opacity-90">Quotes</div>
        </Link>
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

        {/* Recent Activity – from recent projects and quotes */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <Link
                to={user?.role && ['DISTRIBUTOR_REP', 'RSM', 'ADMIN'].includes(effectiveRole(user.role)) ? '/activity' : '/projects'}
                className="text-sm text-green-600 font-medium hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {recentProjects.length === 0 && recentQuotes.length === 0 && !loading && (
                <p className="text-sm text-gray-500">No recent projects or quotes yet.</p>
              )}
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">Project</p>
                    <p className="text-sm text-gray-600 truncate">{p.name} • {formatRelativeTime(p.updatedAt)}</p>
                  </div>
                </Link>
              ))}
              {recentQuotes.map((q) => (
                <Link
                  key={q.id}
                  to={`/quotes/${q.id}`}
                  className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">Quote</p>
                    <p className="text-sm text-gray-600 truncate">{q.quoteNumber || q.id} • {formatRelativeTime(q.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
