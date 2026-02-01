import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role: 'FREE' | 'BASIC' | 'TURNKEY' | 'DISTRIBUTOR' | 'RSM' | 'ADMIN';
  catalogId?: string | null;
  turnkeyTeamId?: string | null;
  sessionId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True when user chose "Continue without signing in" - limited access, no saved data */
  isGuest: boolean;
  login: (user: User, token: string) => void;
  loginAsGuest: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

/** True when user is in guest/limited access mode (no login) */
export const isGuestUser = (state: AuthState) =>
  state.isGuest || (state.user?.role === 'FREE' && !state.token);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: false,
        }),

      loginAsGuest: () =>
        set({
          user: {
            id: 'guest',
            role: 'FREE',
          },
          token: null,
          isAuthenticated: true,
          isGuest: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
