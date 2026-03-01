import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, User, Search, Menu, LogIn, LogOut, BookOpen, ChevronDown } from 'lucide-react';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { useActiveProjectBook } from '@/hooks/useActiveProjectBook';
import { notificationApi } from '@/lib/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Build full URL for avatar (backend path like /uploads/avatars/xxx). */
function avatarImageUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  const base = API_URL.replace(/\/$/, '');
  const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  return `${base}${path}`;
}

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
  const { user, logout } = useAuthStore();
  const isGuest = useAuthStore(isGuestUser);
  const navigate = useNavigate();
  const {
    activeCatalogId,
    activeCatalogName,
    assignedProjectBooks,
    hasAssignedProjectBooks,
    isLoading: projectBookLoading,
    isSwitching,
    setActiveProjectBook,
  } = useActiveProjectBook();
  const showProjectBookInHeader = !isGuest && !projectBookLoading && hasAssignedProjectBooks;
  const [projectBookDropdownOpen, setProjectBookDropdownOpen] = useState(false);
  const projectBookDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    setAvatarError(false);
  }, [user?.avatarUrl]);

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
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (projectBookDropdownRef.current && !projectBookDropdownRef.current.contains(event.target as Node)) {
        setProjectBookDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

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

        <form
          className="hidden md:flex flex-1 max-w-lg mx-8"
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            if (q) navigate(`/catalog?search=${encodeURIComponent(q)}`);
          }}
        >
          <div className="relative w-full">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search parts, projects..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wago-green focus:border-transparent"
            />
          </div>
        </form>

        {/* Active project book – always visible when user has assigned books */}
        {showProjectBookInHeader && (
          <div className="hidden sm:block relative" ref={projectBookDropdownRef}>
            <button
              type="button"
              onClick={() => setProjectBookDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-800 hover:bg-green-100 transition-colors text-sm font-medium max-w-[180px]"
              title="Quick Grid and Video Academy use this project book"
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{activeCatalogName ?? 'Project book'}</span>
              <ChevronDown className={clsx('w-4 h-4 flex-shrink-0 transition-transform', projectBookDropdownOpen && 'rotate-180')} />
              {isSwitching && (
                <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </button>
            {projectBookDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                  Switch project book
                </div>
                {assignedProjectBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setActiveProjectBook(book.id);
                      setProjectBookDropdownOpen(false);
                    }}
                    disabled={isSwitching}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${book.id === activeCatalogId ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className="truncate">{book.name}</span>
                    {book.id === activeCatalogId && <span className="text-green-600 text-xs flex-shrink-0">Active</span>}
                  </button>
                ))}
                <Link
                  to="/catalog-list"
                  onClick={() => setProjectBookDropdownOpen(false)}
                  className="block px-3 py-2 text-sm text-green-600 hover:bg-green-50 border-t border-gray-100"
                >
                  Manage project books →
                </Link>
              </div>
            )}
          </div>
        )}
        {showProjectBookInHeader && (
          <Link
            to="/catalog-list"
            className="sm:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-green-50 text-green-800 text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            <span className="truncate max-w-[100px]">{activeCatalogName ?? 'Book'}</span>
          </Link>
        )}

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
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-wago-blue rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user?.avatarUrl && !avatarError ? (
                    <img
                      src={avatarImageUrl(user.avatarUrl) ?? ''}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900 hidden md:inline">
                  {user?.firstName || user?.email}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
