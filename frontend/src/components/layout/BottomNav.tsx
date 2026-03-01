import { Link, useLocation } from 'react-router-dom';
import { Home, Grid3x3, PlayCircle, FolderKanban, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

interface BottomNavProps {
  onMenuClick?: () => void;
}

const BottomNav = ({ onMenuClick }: BottomNavProps) => {
  const location = useLocation();
  const { user } = useAuthStore();

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/catalog', icon: Grid3x3, label: 'Quick Grid' },
    { path: '/videos', icon: PlayCircle, label: 'Videos' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
          
          return (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive
                  ? 'text-wago-green'
                  : 'text-gray-600'
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-600"
        >
          <Menu className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
