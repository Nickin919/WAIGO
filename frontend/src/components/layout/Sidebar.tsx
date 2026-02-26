import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, Grid3x3, PlayCircle, FolderKanban, DollarSign, Users, Calculator, Settings, BarChart3, Search, Link2, TrendingUp, UserCircle, ClipboardList, BookOpen, Film, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';
import { publicApi } from '@/lib/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { data: featureFlags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data } = await publicApi.getFeatureFlags();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/sales', icon: TrendingUp, label: 'Sales Dashboard', roles: ['RSM', 'ADMIN'] },
    { path: '/catalog', icon: Grid3x3, label: 'Quick Grid', roles: ['FREE', 'BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/catalog-list', icon: FolderKanban, label: 'My Project Books', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/product-finder', icon: Search, label: 'Product Finder', roles: ['FREE'] },
    { path: '/bom-cross-reference', icon: Link2, label: 'BOM Cross-Reference', roles: ['FREE'] },
    { path: '/bom-analyzer', icon: ClipboardList, label: 'BOM Analyzer', roles: ['FREE'] },
    { path: '/videos', icon: PlayCircle, label: 'Video Academy', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/projects', icon: FolderKanban, label: 'Projects', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/quotes', icon: DollarSign, label: 'Quotes', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/literature', icon: BookOpen, label: 'Literature Library', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/videos/library', icon: Film, label: 'Video Library', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/customers', icon: UserCircle, label: 'Manage my customers', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN', 'TURNKEY', 'BASIC', 'DISTRIBUTOR'] },
    { path: '/my-price-contracts', icon: Calculator, label: 'My Price Contracts', roles: ['BASIC_USER', 'DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
  ];

  const managementItems = [
    { path: '/accounts', icon: Users, label: 'Accounts', roles: ['DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/pricing-contracts', icon: Calculator, label: 'Pricing Contracts', roles: ['DIRECT_USER', 'DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
    { path: '/activity', icon: BarChart3, label: 'Activity Dashboard', roles: ['DISTRIBUTOR_REP', 'RSM', 'ADMIN'] },
  ];

  const adminItems = [
    { path: '/admin', icon: Settings, label: 'Administration', roles: ['ADMIN'] },
  ];

  const shouldShowNav = (navRoles: string[]) => {
    return user && navRoles.includes(effectiveRole(user.role));
  };

  const showByFeatureFlag = (path: string) => {
    if (path === '/bom-analyzer' && featureFlags?.bomAnalyzer === false) return false;
    if (path === '/projects' && featureFlags?.projects === false) return false;
    return true;
  };

  const filteredNavItems = navItems.filter(item => shouldShowNav(item.roles) && showByFeatureFlag(item.path));
  const filteredManagementItems = managementItems.filter(item => shouldShowNav(item.roles));
  const filteredAdminItems = adminItems.filter(item => shouldShowNav(item.roles));

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-16 left-0 h-[calc(100vh-4rem)] w-60 bg-white border-r border-gray-200 z-40 transition-transform duration-300 overflow-y-auto flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Main Navigation */}
        <nav className="p-4 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Main</div>
          <div className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Management Section (Distributor, RSM, Admin) */}
        {filteredManagementItems.length > 0 && (
          <nav className="p-4 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Management</div>
            <div className="space-y-1">
              {filteredManagementItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        {/* Admin Section */}
        {filteredAdminItems.length > 0 && (
          <nav className="p-4 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">System</div>
            <div className="space-y-1">
              {filteredAdminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        {/* Sign Out */}
        <div className="p-4 mt-auto">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
              toast.success('Logged out successfully');
              navigate('/login');
            }}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
