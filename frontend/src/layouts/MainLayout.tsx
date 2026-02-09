import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { authApi } from '@/lib/api';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore(isGuestUser);
  const updateUser = useAuthStore((s) => s.updateUser);

  // Refetch current user on load so header has fresh profile (e.g. avatarUrl) after refresh or new tab
  useEffect(() => {
    if (!token || isGuest) return;
    authApi.getCurrentUser().then((res) => {
      if (res.data && typeof res.data === 'object') updateUser(res.data as Record<string, unknown>);
    }).catch(() => {});
  }, [token, isGuest, updateUser]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="lg:ml-60 pt-16 min-h-screen pb-16 lg:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
