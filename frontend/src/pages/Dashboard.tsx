import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, DollarSign, Package, FolderKanban, Video, FileText, Library, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';
import { catalogApi, projectApi, quoteApi, literatureKitApi } from '@/lib/api';
import { DashboardWorkflow } from '@/components/workflow/DashboardWorkflow';

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
  const [catalogSummary, setCatalogSummary] = useState<{ catalogCount: number; averagePartsPerCatalog: number; totalPartsCount?: number } | null>(null);
  const [kitsCount, setKitsCount] = useState<number | null>(null);
  const [recentKits, setRecentKits] = useState<{ id: string; name: string; updatedAt: string; itemCount?: number }[]>([]);
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
            const data = r.data as { catalogCount: number; averagePartsPerCatalog: number; totalPartsCount?: number };
            setCatalogSummary(data);
            return data;
          }).catch(() => {
            setCatalogSummary(null);
            return null;
          })
        );
        promises.push(
          literatureKitApi.list().then((r) => {
            const list = Array.isArray(r.data?.items) ? r.data.items : [];
            setKitsCount(r.data?.total ?? list.length);
            setRecentKits(
              list.slice(0, 3).map((k: any) => ({
                id: k.id,
                name: k.name,
                updatedAt: k.updatedAt,
                itemCount: k.itemCount,
              }))
            );
            return list;
          }).catch(() => {
            setKitsCount(0);
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

  const partsLabel = catalogSummary?.totalPartsCount != null
    ? catalogSummary.totalPartsCount
    : (stats?.partsCount != null ? stats.partsCount : (loading ? '…' : '—'));
  const videosLabel = stats?.videosCount != null ? stats.videosCount : '—';
  const projectsLabel = projectsCount != null ? projectsCount : (loading ? '…' : 0);
  const quotesLabel = quotesCount != null ? quotesCount : (loading ? '…' : 0);
  const catalogCountLabel = catalogSummary != null ? catalogSummary.catalogCount : (loading ? '…' : 0);
  const averagePartsPerCatalog = catalogSummary?.averagePartsPerCatalog ?? null;
  const kitsLabel = kitsCount != null ? kitsCount : (loading ? '…' : 0);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Link
          to="/catalog-list"
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-wago-blue transition-all block group"
        >
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
            <Library className="w-5 h-5 text-wago-blue" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{catalogCountLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Catalogs</div>
          {averagePartsPerCatalog != null && (
            <div className="text-xs text-gray-400 mt-1">Avg {averagePartsPerCatalog.toLocaleString()} parts</div>
          )}
        </Link>
        <Link
          to={user?.catalogId ? '/catalog' : '/catalog-list'}
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-wago-green transition-all block group"
        >
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-wago-green" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{partsLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Total Parts</div>
        </Link>
        <Link
          to="/projects"
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-500 transition-all block group"
        >
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
            <FolderKanban className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{projectsLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Projects</div>
        </Link>
        <Link
          to="/videos"
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-purple-500 transition-all block group"
        >
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
            <Video className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{videosLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Videos</div>
        </Link>
        <Link
          to="/quotes"
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-orange-500 transition-all block group"
        >
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{quotesLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Quotes</div>
        </Link>
        <Link
          to="/literature/kits"
          className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all block group"
        >
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{kitsLabel}</div>
          <div className="text-sm text-gray-500 mt-0.5">Literature Kits</div>
        </Link>
      </div>

      {/* Row-based workflow: BOM → Project/Quote/Catalog → Review */}
      <div className="mb-8">
        <DashboardWorkflow />
      </div>

      {/* Recent Activity – sorted by date, name as headline */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <Link
            to={user?.role && ['DISTRIBUTOR_REP', 'RSM', 'ADMIN'].includes(effectiveRole(user.role)) ? '/activity' : '/projects'}
            className="text-sm text-wago-green font-medium hover:underline"
          >
            View All
          </Link>
        </div>
        {(() => {
          const combined = [
            ...recentProjects.map((p) => ({ id: p.id, name: p.name, date: p.updatedAt, type: 'project' as const, href: `/projects/${p.id}` })),
            ...recentQuotes.map((q) => ({ id: q.id, name: q.quoteNumber || q.id, date: q.createdAt, type: 'quote' as const, href: `/quotes/${q.id}` })),
            ...recentKits.map((k) => ({ id: k.id, name: k.name, date: k.updatedAt, type: 'kit' as const, href: `/literature/kits/${k.id}`, itemCount: k.itemCount })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

          const typeConfig = {
            project: { label: 'Project', icon: CheckCircle, iconClass: 'text-blue-600', bgClass: 'bg-blue-50', badgeClass: 'bg-blue-100 text-blue-700' },
            quote: { label: 'Quote', icon: DollarSign, iconClass: 'text-orange-600', bgClass: 'bg-orange-50', badgeClass: 'bg-orange-100 text-orange-700' },
            kit: { label: 'Literature Kit', icon: BookOpen, iconClass: 'text-teal-600', bgClass: 'bg-teal-50', badgeClass: 'bg-teal-100 text-teal-700' },
          };

          if (combined.length === 0 && !loading) {
            return <p className="text-sm text-gray-500">No recent activity yet. Start by uploading a BOM above.</p>;
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {combined.map((item) => {
                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={item.href}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className={`w-9 h-9 ${cfg.bgClass} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badgeClass}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(item.date)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Dashboard;
