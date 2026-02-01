import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { userManagementApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  role: string;
  isActive: boolean;
  turnkeyTeam?: { id: string; name: string } | null;
  assignedToDistributor?: { id: string; email: string | null; companyName: string | null } | null;
  assignedToRsm?: { id: string; email: string | null } | null;
  createdAt: string;
}

const ManagedUsersPage = () => {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canManage = user?.role && ['ADMIN', 'RSM', 'DISTRIBUTOR'].includes(user.role);

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    userManagementApi
      .getUsers({ search: search || undefined })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setUsers(data);
      })
      .catch(() => {
        toast.error('Failed to load users');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [canManage, search]);

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to managed users.</p>
      </div>
    );
  }

  const displayName = (u: User) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Managed Users</h1>
          <p className="text-gray-600 mt-1">
            Users in your hierarchy. Use Assignments for catalog and price contract assignments.
          </p>
        </div>
        <Link
          to="/assignments"
          className="btn btn-primary flex items-center gap-2 w-fit"
        >
          <UserPlus className="w-5 h-5" />
          Catalog & Contract Assignments
        </Link>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Distributor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Team</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{displayName(u)}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.assignedToDistributor?.companyName || u.assignedToDistributor?.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.turnkeyTeam?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/assignments?userId=${u.id}`}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Assignments
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagedUsersPage;
