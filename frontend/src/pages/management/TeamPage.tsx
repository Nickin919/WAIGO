import { useState, useEffect } from 'react';
import { Users, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Team {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }>;
  _count?: { members: number; costTables: number };
}

const TeamPage = () => {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamApi
      .getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setTeams(data);
      })
      .catch(() => {
        toast.error('Failed to load teams');
        setTeams([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayName = (m: { firstName: string | null; lastName: string | null; email: string | null }) =>
    [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '—';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
        <p className="text-gray-600 mt-1">Your TurnKey team and members.</p>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : teams.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">You are not in a team, or no teams found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((team) => (
            <div key={team.id} className="card overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h2 className="text-lg font-bold text-gray-900">{team.name}</h2>
                {team.description && (
                  <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {team._count?.members ?? team.members.length} members
                  {team._count?.costTables != null && ` • ${team._count.costTables} cost tables`}
                </p>
              </div>
              <div className="divide-y">
                {team.members.map((m) => (
                  <div
                    key={m.id}
                    className="px-6 py-3 flex items-center gap-3"
                  >
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <span className="font-medium">{displayName(m)}</span>
                      <span className="text-gray-500 text-sm ml-2">{m.email}</span>
                    </div>
                    <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamPage;
