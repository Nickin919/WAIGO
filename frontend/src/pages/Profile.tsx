import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';
import toast from 'react-hot-toast';

const roleLabel = (role: string): string => {
  const r = effectiveRole(role);
  if (r === 'DISTRIBUTOR_REP') return 'Distributor';
  if (r === 'DIRECT_USER') return 'Direct';
  if (r === 'BASIC_USER') return 'Basic';
  return r.toLowerCase().replace(/_/g, ' ');
};

const Profile = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="container-custom py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      <div className="max-w-2xl">
        <div className="card p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-wago-blue rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-600" />
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{user?.email}</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <div className="text-sm text-gray-600">Role</div>
                <div className="font-medium capitalize">{user?.role ? roleLabel(user.role) : ''}</div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-outline flex items-center space-x-2 w-full justify-center"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Profile;
