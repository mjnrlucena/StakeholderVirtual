import { create } from "zustand";
import type { AuthUser } from "@/types/auth";
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister } from "@/services/api";

interface AuthState {
  user: AuthUser | null;
  /** true enquanto ainda não sabemos se há uma sessão válida (cookie) ou não. */
  isLoading: boolean;
  loadSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  // Chamado uma vez ao carregar o app: tenta GET /auth/me (o cookie, se
  // válido, já autentica) para decidir se mostra login ou app.
  loadSession: async () => {
    try {
      const user = await fetchMe();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    const user = await apiLogin(email, password);
    set({ user });
  },

  register: async (email, password) => {
    const user = await apiRegister(email, password);
    set({ user });
  },

  logout: async () => {
    await apiLogout();
    set({ user: null });
  },
}));
