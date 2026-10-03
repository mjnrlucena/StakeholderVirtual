import { ArrowLeft, BarChart3, LogOut, Shield } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { NewChatButton } from "./NewChatButton";
import { ThemeToggle } from "./ThemeToggle";
import { isProfessor, isStaff } from "@/lib/roles";

/**
 * Barra fixa no topo.
 * - Seta de voltar (fora da tela inicial): mesma função de clicar no título,
 *   leva para a escolha de projetos ("/").
 * - "Nova conversa" (só quando há um projeto aberto), atalho do hub de admin
 *   (equipe) e dashboard de logs (professor/superadmin), tema e sair (somente ícones).
 */
export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();

  const showBack = Boolean(user) && pathname !== "/";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="fixed inset-x-0 top-0 z-20 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/90 to-transparent">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {showBack && (
            <Link to="/" title="Voltar para os projetos" aria-label="Voltar" className="icon-btn">
              <ArrowLeft size={18} />
            </Link>
          )}
          {/* No celular a seta já faz o papel do título, então ele some para dar espaço aos botões. */}
          <Link
            to="/"
            className={`truncate text-sm font-medium text-[var(--text-secondary)]  hover:text-[var(--text-primary)] ${
              showBack ? "hidden sm:block" : ""
            }`}
          >
            Stakeholder Virtual
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isProfessor(user?.role) && (
            <Link to="/admin/logs" title="Dashboard de conversas" aria-label="Dashboard de conversas" className="icon-btn">
              <BarChart3 size={17} />
            </Link>
          )}
          {isStaff(user?.role) && (
            <Link to="/admin" title="Hub de administração" aria-label="Hub de administração" className="icon-btn">
              <Shield size={17} />
            </Link>
          )}
          {projectId && <NewChatButton projectId={projectId} />}
          <ThemeToggle />
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair da conta"
              className="icon-btn"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}