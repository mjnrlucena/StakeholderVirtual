import { LogOut, Shield } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { NewChatButton } from "./NewChatButton";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Barra fixa no topo. Mostra o botão de novo chat (só quando há um
 * projeto aberto), o e-mail do usuário logado, um atalho para o hub de
 * admin (só para quem é ADMIN) e logout.
 */
export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="fixed inset-x-0 top-0 z-20 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/90 to-transparent">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-3">
        <Link to="/" className="text-sm font-medium text-[var(--text-secondary)]">
          Stakeholder Virtual
        </Link>

        <div className="flex items-center gap-1">
          {projectId && <NewChatButton projectId={projectId} />}
          {(user?.role === "ADMIN" || user?.role === "SUPERADMIN")  && (
            <Link to="/admin" title="Hub de administração" className="icon-btn">
              <Shield size={17} />
            </Link>
          )}
          <ThemeToggle />
          {user && (
            <button type="button" onClick={handleLogout} title="Sair" className="icon-btn">
              <LogOut size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
