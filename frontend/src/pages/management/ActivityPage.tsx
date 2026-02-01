import { useState, useEffect } from 'react';
import { BarChart3, FileText, DollarSign, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';
import { userManagementApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface ActivityData {
  recentProjects?: Array<{ id: string; name: string; user?: { firstName: string | null; lastName: string | null; email: string | null } }>;
  recentQuotes?: Array<{ id: string; quoteNumber: string; user?: { firstName: string | null; lastName: string | null; email: string | null } }>;
  recentLogins?: Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null }>;
}

const ActivityPage = () => {
  const { user } = useAuthStore();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  const canView = user?.role && ['DISTRIBUTOR', 'RSM', 'ADMIN'].includes(user.role);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    userManagementApi
      .getActivity()
      .then((res) => {
        setActivity(res.data as ActivityData);
      })
      .catch(() => {
        toast.error('Failed to load activity');
        setActivity(null);
      })
      .finally(() => setLoading(false));
  }, [canView]);

  const displayName = (u?: { firstName: string | null; lastName: string | null; email?: string | null }) =>
    u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—' : '—';

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to activity dashboard.</p>
      </div>
    );
  }

  if (loading || !activity) {
    return (
      <div className="p-6">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const projects = activity.recentProjects || [];
  const quotes = activity.recentQuotes || [];
  const logins = activity.recentLogins || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Dashboard</h1>
        <p className="text-gray-600 mt-1">Recent activity from your managed users.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban className="w-6 h-6 text-green-600" />
            <h2 className="font-bold text-gray-900">Recent Projects</h2>
          </div>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent projects</p>
          ) : (
            <ul className="space-y-2">
              {projects.slice(0, 8).map((p) => (
                <li key={p.id} className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-gray-500"> by {displayName(p.user)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="font-bold text-gray-900">Recent Quotes</h2>
          </div>
          {quotes.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent quotes</p>
          ) : (
            <ul className="space-y-2">
              {quotes.slice(0, 8).map((q) => (
                <li key={q.id} className="text-sm">
                  <span className="font-medium">{q.quoteNumber}</span>
                  <span className="text-gray-500"> by {displayName(q.user)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-6 h-6 text-green-600" />
            <h2 className="font-bold text-gray-900">Recent Logins</h2>
          </div>
          {logins.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent login data</p>
          ) : (
            <ul className="space-y-2">
              {logins.slice(0, 8).map((l) => (
                <li key={l.id} className="text-sm">
                  {displayName(l)} {l.email && `(${l.email})`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
