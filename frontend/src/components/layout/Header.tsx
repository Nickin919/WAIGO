import { Link } from 'react-router-dom';
import { Bell, User, Search, Menu, LogIn } from 'lucide-react';
import { useAuthStore, isGuestUser } from '@/stores/authStore';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { user } = useAuthStore();
  const isGuest = useAuthStore(isGuestUser);

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <Link to={isGuest ? '/catalog' : '/dashboard'} className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-wago-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <span className="font-bold text-xl text-gray-900 hidden sm:inline">
              WAGO Hub
            </span>
          </Link>
        </div>

        {/* Search Bar (Desktop) */}
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

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User menu or Sign in (for guest) */}
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
              <div className="w-8 h-8 bg-wago-blue rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
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
