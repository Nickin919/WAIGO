import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, User, Search, Menu, LogIn } from 'lucide-react';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { notificationApi } from '@/lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { user } = useAuthStore();
  const isGuest = useAuthStore(isGuestUser);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = (unreadOnly?: boolean) => {
    setLoading(true);
    notificationApi
      .getAll(unreadOnly)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setNotifications(list);
        if (unreadOnly === undefined) {
          setUnreadCount(list.filter((n: Notification) => !n.isRead).length);
        }
      })
      .catch(() => {
        setNotifications([]);
        if (unreadOnly !== true) setUnreadCount(0);
      })
      .finally(() => setLoading(false));
  };

  const fetchUnreadCount = () => {
    notificationApi
      .getAll(true)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setUnreadCount(list.length);
      })
      .catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    if (!isGuest && notificationsOpen) {
      fetchNotifications();
    }
  }, [notificationsOpen, isGuest]);

  useEffect(() => {
    if (!isGuest) fetchUnreadCount();
  }, [isGuest]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = (id: string) => {
    notificationApi.markAsRead(id).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    });
  };

  const handleMarkAllAsRead = () => {
    notificationApi.markAllAsRead().then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  };

  const formatNotificationTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to={isGuest ? '/catalog' : '/dashboard'} className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-wago-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <span className="font-bold text-xl text-gray-900 hidden sm:inline">
              WAGO Hub
            </span>
          </Link>
        </div>

        <div className="hidden md:flex flex-1 max-w-lg mx-8">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search parts, projects..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wago-green focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications – only when logged in */}
          {!isGuest && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((o) => !o)}
                className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
                aria-label="Notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-medium text-white bg-red-500 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-1 w-96 max-h-[80vh] overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col">
                  <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">Notifications</span>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/notifications"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-sm text-wago-green hover:underline whitespace-nowrap"
                      >
                        View all
                      </Link>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-sm text-wago-green hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {loading ? (
                      <div className="p-6 text-center text-gray-500">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No notifications</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className={`p-3 hover:bg-gray-50 ${!n.isRead ? 'bg-green-50/50' : ''}`}
                          >
                            <div className="flex gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                                {n.message && (
                                  <p className="text-sm text-gray-600 truncate mt-0.5">{n.message}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatNotificationTime(n.createdAt)}
                                </p>
                              </div>
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-xs text-wago-green hover:underline flex-shrink-0"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isGuest ? (
            <Link
              to="/login"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in</span>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-wago-blue rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_URL}${user.avatarUrl}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900 hidden md:inline">
                {user?.firstName || user?.email}
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
