import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2, Check, CheckCheck, Trash2 } from 'lucide-react';
import { notificationApi } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

const getRelatedLink = (n: Notification): string | null => {
  if (!n.relatedId) return null;
  const t = n.type?.toLowerCase() || '';
  if (t.includes('quote')) return `/quotes/${n.relatedId}`;
  if (t.includes('project')) return `/projects/${n.relatedId}`;
  if (t.includes('customer')) return `/customers`;
  if (t.includes('video')) return `/video/${n.relatedId}`;
  return null;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
};

const NotificationsPage = () => {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = () => {
    setLoading(true);
    notificationApi
      .getAll()
      .then((res) => {
        setList(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleMarkAsRead = (id: string) => {
    notificationApi.markAsRead(id).then(() => {
      setList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    });
  };

  const handleMarkAllAsRead = () => {
    notificationApi.markAllAsRead().then(() => {
      setList((prev) => prev.map((n) => ({ ...n, isRead: true })));
    });
  };

  const handleDelete = (id: string) => {
    notificationApi.delete(id).then(() => {
      setList((prev) => prev.filter((n) => n.id !== id));
    });
  };

  const unreadCount = list.filter((n) => !n.isRead).length;

  return (
    <div className="container-custom py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="w-8 h-8" />
          Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="btn btn-outline flex items-center gap-2 w-fit"
          >
            <CheckCheck className="w-5 h-5" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {list.map((n) => {
              const href = getRelatedLink(n);
              const textBlock = (
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${n.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{formatTime(n.createdAt)}</p>
                </div>
              );
              return (
                <li
                  key={n.id}
                  className={`p-4 flex items-start gap-3 ${!n.isRead ? 'bg-green-50/50' : ''}`}
                >
                  {href ? (
                    <Link
                      to={href}
                      className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
                    >
                      {textBlock}
                    </Link>
                  ) : (
                    <div className="flex-1 min-w-0">{textBlock}</div>
                  )}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="p-2 text-gray-500 hover:text-wago-green hover:bg-gray-100 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(n.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
