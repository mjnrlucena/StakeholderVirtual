import { create } from "zustand";
import type { AuthUser } from "@/types/auth";
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  selecionarTurma as apiSelecionarTurma,
  type RegisterInput,
} from "@/services/api";

interface AuthState {
  user: AuthUser | null;
  /** true enquanto ainda não sabemos se há uma sessão válida (cookie) ou não. */
  isLoading: boolean;
  /** Depois do login, quem tem mais de uma turma escolhe qual usar. */
  escolherTurma: boolean;
  loadSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  selecionarTurma: (turmaId: string) => Promise<void>;
  trocarTurma: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  escolherTurma: false,

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
    set({ user, escolherTurma: user.turmas.length > 1 });
  },

  register: async (input) => {
    const user = await apiRegister(input);
    set({ user });
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, escolherTurma: false });
  },

  selecionarTurma: async (turmaId) => {
    const user = await apiSelecionarTurma(turmaId);
    set({ user, escolherTurma: false });
  },

  trocarTurma: () => set({ escolherTurma: true }),
}));
