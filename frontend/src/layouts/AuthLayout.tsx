import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, isGuestUser } from '@/stores/authStore';

const AuthLayout = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const guest = useAuthStore(isGuestUser);

  // Redirect only non-guest authenticated users (they're already logged in)
  // Allow guests to stay on /login so they can sign in
  if (isAuthenticated && !guest) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wago-blue to-wago-green flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">WAGO</h1>
          <p className="text-white/90">Project Hub</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
